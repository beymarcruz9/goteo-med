import { TestBed } from '@angular/core/testing';
import {
  PatientFormPayload,
  PatientInfusionRecord,
} from '../models/shift.model';
import {
  ShiftManagerService,
  computePatientInfusionState,
} from './shift-manager.service';

describe('ShiftManagerService y Cálculo por Timestamps', () => {
  let service: ShiftManagerService;
  const memoryStore = new Map<string, string>();

  beforeEach(() => {
    memoryStore.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => memoryStore.get(k) ?? null,
        setItem: (k: string, v: string) => memoryStore.set(k, String(v)),
        removeItem: (k: string) => memoryStore.delete(k),
        clear: () => memoryStore.clear(),
      },
    });

    TestBed.configureTestingModule({});
    service = TestBed.inject(ShiftManagerService);
  });

  it('función pura computePatientInfusionState recalcula el volumen restante usando solo marcas de tiempo', () => {
    const baseTime = 1_700_000_000_000;
    // Paciente con 1000 ml a 100 ml/h (goteo exacto 33.333 gotas/min a FG 20)
    const record: PatientInfusionRecord = {
      id: 'p1',
      notificationId: 20001,
      ward: 'Medicina',
      bed: '12',
      patientName: 'Juan Pérez',
      solutionType: 'Solución Fisiológica 0.9%',
      additives: [],
      origin: 'new',
      bagTotalVolumeMl: 1000,
      receivedVolumeMl: 1000,
      dripFactor: 20,
      exactDropsPerMinute: 33.333333,
      baselineDropsPerMinute: 33.333333,
      mlPerHour: 100, // 100 ml por hora
      anchorStartTimeMs: baseTime,
      anchorVolumeMl: 1000,
      createdAtMs: baseTime,
      alarmEnabled: true,
    };

    // 2 horas después (7,200,000 ms)
    const twoHoursLater = baseTime + 2 * 3_600_000;
    const computed = computePatientInfusionState(record, twoHoursLater, baseTime + 6 * 3_600_000);

    expect(computed.remainingMl).toBeCloseTo(800, 1);
    expect(computed.infusedThisShiftMl).toBeCloseTo(200, 1);
    expect(computed.remainingMinutes).toBeCloseTo(480, 1); // 8 horas restantes
    expect(computed.urgency).toBe('stable');
    expect(computed.isCompleted).toBe(false);
  });

  it('clasifica con semáforo Rojo si quedan <15 minutos y Amarillo entre 15 y 45 minutos', () => {
    const baseTime = 1_700_000_000_000;
    const record: PatientInfusionRecord = {
      id: 'p2',
      notificationId: 20002,
      ward: 'Cirugía',
      bed: '4',
      patientName: 'Rosa Flores',
      solutionType: 'Dextrosa 5%',
      additives: [],
      origin: 'inherited',
      bagTotalVolumeMl: 500,
      receivedVolumeMl: 30,
      dripFactor: 20,
      exactDropsPerMinute: 20, // 60 ml/h -> 1 ml/min
      baselineDropsPerMinute: 20,
      mlPerHour: 60,
      anchorStartTimeMs: baseTime,
      anchorVolumeMl: 30, // Quedan 30 ml -> 30 minutos
      createdAtMs: baseTime,
      alarmEnabled: true,
    };

    // Al inicio le quedan 30 min -> Semáforo Amarillo (warning)
    const stateYellow = computePatientInfusionState(record, baseTime, null);
    expect(stateYellow.urgency).toBe('warning');

    // 20 minutos después -> quedan 10 ml = 10 minutos -> Semáforo Rojo (critical)
    const stateRed = computePatientInfusionState(record, baseTime + 20 * 60_000, null);
    expect(stateRed.urgency).toBe('critical');
    expect(stateRed.remainingMinutes).toBeCloseTo(10, 1);
  });

  it('inicia turno, agrega paciente, ajusta finamente la llave reguladora y genera reporte de entrega', () => {
    service.startShift('6h', 6, 'Turno Mañana');
    expect(service.hasActiveShift()).toBe(true);

    const payload: PatientFormPayload = {
      ward: 'UCI',
      bed: '02',
      patientName: 'Carlos Gómez',
      solutionType: 'Ringer Lactato',
      additives: [{ id: '1', name: 'KCl', dose: '10 ml' }],
      origin: 'new',
      bagTotalVolumeMl: 1000,
      receivedVolumeMl: 1000,
      dripFactor: 20,
      exactDropsPerMinute: 20, // 60 ml/h
      alarmEnabled: true,
    };

    const patient = service.addPatient(payload);
    expect(service.patients().length).toBe(1);

    // Ajuste fino +2 gotas/min
    service.adjustPatientDrops(patient.id, 2);
    const updated = service.getComputedPatientById(patient.id)!;
    expect(updated.isFineTuned).toBe(true);
    expect(updated.record.exactDropsPerMinute).toBe(22);

    // Reporte de entrega contiene al paciente y sus agregados
    const report = service.buildHandoverTextReport();
    expect(report).toContain('Carlos Gómez');
    expect(report).toContain('Ringer Lactato');
    expect(report).toContain('KCl (10 ml)');
  });

  it('protección estricta: los datos persisten y solo se borran con finishAndClearShift()', async () => {
    service.startShift('12h');
    service.addPatient({
      ward: 'A',
      bed: '1',
      patientName: 'Paciente Test',
      solutionType: 'Mixto',
      additives: [],
      origin: 'new',
      bagTotalVolumeMl: 500,
      receivedVolumeMl: 500,
      dripFactor: 20,
      exactDropsPerMinute: 21,
      alarmEnabled: true,
    });

    expect(service.patients().length).toBe(1);

    // Finalizar turno con modal estricto limpia datos permanentemente
    await service.finishAndClearShift();
    expect(service.hasActiveShift()).toBe(false);
    expect(service.patients().length).toBe(0);
  });
});

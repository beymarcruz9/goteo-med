import { TestBed } from '@angular/core/testing';
import { InfusionCalculatorService } from './infusion-calculator.service';

describe('InfusionCalculatorService', () => {
  let service: InfusionCalculatorService;
  const memoryStorage = new Map<string, string>();

  beforeEach(() => {
    memoryStorage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => memoryStorage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          memoryStorage.set(key, String(value));
        },
        removeItem: (key: string) => {
          memoryStorage.delete(key);
        },
        clear: () => {
          memoryStorage.clear();
        },
      },
    });

    TestBed.configureTestingModule({});
    service = TestBed.inject(InfusionCalculatorService);
  });

  it('calcula correctamente los valores predeterminados (500 ml, 8 h, Normogotero 20 gtt/ml)', () => {
    const res = service.result();
    expect(res).not.toBeNull();
    // (500 * 20) / (8 * 60) = 10000 / 480 = 20.8333...
    expect(res!.exactDropsPerMinute).toBeCloseTo(20.8333, 3);
    expect(res!.roundedDropsPerMinute).toBe(21);
    expect(res!.mlPerHour).toBeCloseTo(62.5, 2);
    expect(res!.mlPerMinute).toBeCloseTo(1.0417, 3);
    expect(res!.secondsPerDrop).toBeCloseTo(2.88, 2);
    expect(res!.intervalMs).toBeCloseTo(2880, 1);
  });

  it('convierte unidades de volumen (ml <-> L) manteniendo el resultado clínico', () => {
    service.setVolumeUnit('L');
    expect(service.config().volume).toBeCloseTo(0.5, 3);
    expect(service.result()!.exactDropsPerMinute).toBeCloseTo(20.8333, 3);

    service.setVolumeUnit('ml');
    expect(service.config().volume).toBe(500);
    expect(service.result()!.exactDropsPerMinute).toBeCloseTo(20.8333, 3);
  });

  it('convierte unidades de tiempo (h <-> min) correctamente', () => {
    service.setTimeUnit('min');
    expect(service.config().time).toBe(480);
    expect(service.result()!.exactDropsPerMinute).toBeCloseTo(20.8333, 3);

    service.setTimeUnit('h');
    expect(service.config().time).toBe(8);
  });

  it('calcula correctamente con Microgotero (60 gtt/ml) y Macrogotero (10 y 15 gtt/ml)', () => {
    service.setDripFactorPreset('micro60', 60);
    // En microgotero (60 gtt/ml), gotas/min coincide exactamente con ml/h = 62.5
    expect(service.result()!.exactDropsPerMinute).toBeCloseTo(62.5, 2);
    expect(service.result()!.secondsPerDrop).toBeCloseTo(0.96, 2);

    service.setDripFactorPreset('macro10', 10);
    expect(service.result()!.exactDropsPerMinute).toBeCloseTo(10.4167, 3);

    service.setDripFactorPreset('macro15', 15);
    expect(service.result()!.exactDropsPerMinute).toBeCloseTo(15.625, 3);
  });

  it('ajusta finamente con + y - recalculando el tiempo restante y la velocidad', () => {
    // Baseline es 20.8333 gtt/min -> +1 lleva a 21 exactas
    service.adjustDropsPerMinute(1);
    const up = service.result()!;
    expect(up.isFineTuned).toBe(true);
    expect(up.exactDropsPerMinute).toBe(21);
    // Nuevo tiempo = (500 * 20) / 21 = 476.19 min
    expect(up.effectiveDurationMinutes).toBeCloseTo(476.1905, 2);
    expect(up.mlPerHour).toBeCloseTo(63, 2);

    service.resetFineTune();
    expect(service.result()!.isFineTuned).toBe(false);
    expect(service.result()!.effectiveDurationMinutes).toBe(480);

    // Desde baseline 20.8333 -> -1 lleva a 20 exactas (500 min)
    service.adjustDropsPerMinute(-1);
    const down = service.result()!;
    expect(down.exactDropsPerMinute).toBe(20);
    expect(down.effectiveDurationMinutes).toBeCloseTo(500, 2);
  });

  it('persiste y restaura los valores predeterminados en localStorage', () => {
    service.updateVolume(1000);
    service.updateTime(12);
    service.setDripFactorPreset('macro15', 15);

    expect(service.saveAsDefaults()).toBe(true);
    expect(service.hasSavedDefaults()).toBe(true);

    service.updateVolume(250);
    service.restoreDefaults();
    expect(service.config().volume).toBe(1000);
    expect(service.config().time).toBe(12);
    expect(service.config().dripFactor).toBe(15);
  });
});

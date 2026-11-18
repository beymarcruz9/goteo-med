import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('debe crear la aplicación GoteoMed APH', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('debe mostrar el encabezado clínico y la navegación de turnos y multi-paciente', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('GoteoMed');
    expect(compiled.textContent).toContain('Pacientes');
    expect(compiled.textContent).toContain('Entrega Turno');
    expect(compiled.textContent).toContain('Calculadora');
  });
});

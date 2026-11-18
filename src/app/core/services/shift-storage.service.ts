import { Injectable } from '@angular/core';
import { PersistedShiftState } from '../models/shift.model';

const SHIFT_STORAGE_KEY = 'goteomed_shift_manager_v1';
const IDB_NAME = 'goteomed_db';
const IDB_STORE = 'shift_store';
const IDB_KEY = 'current_shift_state';

/**
 * Capa de persistencia ultra-robusta tolerante a cierres accidentales.
 * Combina localStorage (lectura/escritura síncrona instantánea en arranque)
 * con IndexedDB (almacenamiento no volátil de gran capacidad tolerante a limpiezas de caché).
 */
@Injectable({
  providedIn: 'root',
})
export class ShiftStorageService {
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  constructor() {
    this.initIndexedDb();
  }

  /**
   * Lectura síncrona inmediata al arranque para evitar saltos o parpadeos en pantalla.
   */
  loadSync(): PersistedShiftState | null {
    try {
      const raw = localStorage.getItem(SHIFT_STORAGE_KEY);
      if (!raw) return null;
      return this.parseState(raw);
    } catch {
      return null;
    }
  }

  /**
   * Respaldo asíncrono desde IndexedDB en caso de que localStorage esté vacío
   * o haya sido limpiado por el sistema operativo en segundo plano.
   */
  async loadNativeBackup(): Promise<PersistedShiftState | null> {
    try {
      const db = await this.getIdb();
      if (!db) return this.loadSync();

      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);

      const record = await new Promise<string | null>((resolve) => {
        req.onsuccess = () => resolve((req.result as string) || null);
        req.onerror = () => resolve(null);
      });

      if (!record) return this.loadSync();
      return this.parseState(record);
    } catch {
      return this.loadSync();
    }
  }

  /**
   * Guarda de forma redundante e inmediata en localStorage e IndexedDB.
   */
  async save(state: PersistedShiftState): Promise<void> {
    const serialized = JSON.stringify(state);

    // 1. Escritura instantánea en localStorage
    try {
      localStorage.setItem(SHIFT_STORAGE_KEY, serialized);
    } catch {
      // Ignorar quota en navegadores muy restringidos
    }

    // 2. Escritura persistente en IndexedDB
    try {
      const db = await this.getIdb();
      if (db) {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.put(serialized, IDB_KEY);
      }
    } catch {
      // Sin acción
    }
  }

  /**
   * Borra permanentemente los datos del turno SOLO cuando el usuario confirma
   * el modal de advertencia estricta de "Finalizar / Cancelar Turno".
   */
  async clearAll(): Promise<void> {
    try {
      localStorage.removeItem(SHIFT_STORAGE_KEY);
    } catch {
      // Sin acción
    }

    try {
      const db = await this.getIdb();
      if (db) {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.delete(IDB_KEY);
      }
    } catch {
      // Sin acción
    }
  }

  private initIndexedDb(): void {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return;

    this.dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      try {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async getIdb(): Promise<IDBDatabase | null> {
    if (!this.dbPromise) {
      this.initIndexedDb();
    }
    return this.dbPromise ?? null;
  }

  private parseState(raw: string): PersistedShiftState | null {
    try {
      const parsed = JSON.parse(raw) as Partial<PersistedShiftState>;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.patients)) {
        return {
          version: 1,
          shift: parsed.shift ?? null,
          patients: parsed.patients,
          nextNotificationId:
            typeof parsed.nextNotificationId === 'number' && parsed.nextNotificationId >= 20_000
              ? parsed.nextNotificationId
              : 20_001,
          updatedAtMs: typeof parsed.updatedAtMs === 'number' ? parsed.updatedAtMs : Date.now(),
        };
      }
    } catch {
      return null;
    }
    return null;
  }
}

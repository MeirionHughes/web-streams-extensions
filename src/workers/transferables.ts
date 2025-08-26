/**
 * Utility functions for validating values and detecting transferable objects
 * for worker message passing.
 */

export type GetTransferablesFn = (value: any) => Transferable[];

/**
 * Checks if a value is a primitive type (string, number, boolean, null, undefined)
 */
function isPrimitive(value: any): boolean {
  return value === null || value === undefined || 
         typeof value === 'string' || typeof value === 'number' || 
         typeof value === 'boolean' || typeof value === 'bigint';
}

/**
 * Checks if a value is a plain object (not a class instance)
 */
function isPlainObject(value: any): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  
  // Check if it's an array
  if (Array.isArray(value)) {
    return true;
  }
  
  // Check if it's a typed array
  if (ArrayBuffer.isView(value)) {
    return true;
  }
  
  // Check if it's a plain object (Object.prototype as constructor)
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

/**
 * Validates that a value contains only transferable data types
 * (primitives, plain objects, arrays, typed arrays)
 */
export function validateTransferableValue(value: any, path = 'value'): void {
  if (isPrimitive(value)) {
    return;
  }
  
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      validateTransferableValue(item, `${path}[${index}]`);
    });
    return;
  }
  
  if (ArrayBuffer.isView(value)) {
    // Typed arrays are allowed
    return;
  }
  
  if (value instanceof ArrayBuffer) {
    // ArrayBuffers are allowed
    return;
  }
  
  if (isPlainObject(value)) {
    for (const [key, val] of Object.entries(value)) {
      validateTransferableValue(val, `${path}.${key}`);
    }
    return;
  }
  
  // Check for other allowed types
  if (typeof ImageData !== 'undefined' && value instanceof ImageData) {
    return;
  }
  
  if (typeof MessagePort !== 'undefined' && value instanceof MessagePort) {
    return;
  }
  
  if (typeof OffscreenCanvas !== 'undefined' && value instanceof OffscreenCanvas) {
    return;
  }
  
  // If we get here, it's a class instance or unsupported type
  throw new Error(`Invalid value at ${path}: class instances are not allowed for transfer. Got ${Object.prototype.toString.call(value)}`);
}

/**
 * Default implementation that detects transferable objects.
 * 
 * This follows the structured clone algorithm philosophy:
 * - TypedArrays are serialized and efficiently copied by structured clone
 * - ArrayBuffers are transferred only if they are not within a TypedArray
 * - Other transferable objects are detected and transferred when found
 */
export function defaultGetTransferables(value: any): Transferable[] {
  const transferables: Transferable[] = [];
  const seen = new WeakSet();
  
  function collectTransferables(val: any): void {
    if (val === null || val === undefined || isPrimitive(val)) {
      return;
    }
    
    // Avoid infinite recursion with circular references
    if (typeof val === 'object' && seen.has(val)) {
      return;
    }
    
    if (typeof val === 'object') {
      seen.add(val);
    }
    
    // Check for transferable objects (following MDN transferable objects list)
    
    // Core transferable types
    if (val instanceof ArrayBuffer) {
      transferables.push(val);
      return;
    }
    
    // TypedArrays - let structured clone handle them efficiently
    // Don't transfer the underlying buffer, as structured clone can
    // duplicate TypedArrays more efficiently than transferring
    if (ArrayBuffer.isView(val)) {
      // Don't add to transferables - let structured clone handle
      return;
    }
    
    if (typeof MessagePort !== 'undefined' && val instanceof MessagePort) {
      transferables.push(val);
      return;
    }
    
    // Streams (transferable in modern browsers)
    if (typeof ReadableStream !== 'undefined' && val instanceof ReadableStream) {
      transferables.push(val);
      return;
    }
    
    if (typeof WritableStream !== 'undefined' && val instanceof WritableStream) {
      transferables.push(val);
      return;
    }
    
    if (typeof TransformStream !== 'undefined' && val instanceof TransformStream) {
      transferables.push(val);
      return;
    }
    
    // Media types
    if (typeof ImageBitmap !== 'undefined' && val instanceof ImageBitmap) {
      transferables.push(val);
      return;
    }    
    if (typeof ImageData !== 'undefined' && val instanceof ImageData) {
      transferables.push(val);
      return;
    }
    
    if (typeof globalThis !== 'undefined' && 'VideoFrame' in globalThis && 
        val instanceof (globalThis as any).VideoFrame) {
      transferables.push(val);
      return;
    }
    
    if (typeof globalThis !== 'undefined' && 'AudioData' in globalThis && 
        val instanceof (globalThis as any).AudioData) {
      transferables.push(val);
      return;
    }
    
    if (typeof OffscreenCanvas !== 'undefined' && val instanceof OffscreenCanvas) {
      transferables.push(val);
      return;
    }
    
    // WebRTC types
    if (typeof RTCDataChannel !== 'undefined' && val instanceof RTCDataChannel) {
      transferables.push(val);
      return;
    }
    
    if (typeof MediaStreamTrack !== 'undefined' && val instanceof MediaStreamTrack) {
      transferables.push(val);
      return;
    }
    
    // WebTransport types (newer browsers)
    if (typeof globalThis !== 'undefined' && 'WebTransportReceiveStream' in globalThis && 
        val instanceof (globalThis as any).WebTransportReceiveStream) {
      transferables.push(val);
      return;
    }
    
    if (typeof globalThis !== 'undefined' && 'WebTransportSendStream' in globalThis && 
        val instanceof (globalThis as any).WebTransportSendStream) {
      transferables.push(val);
      return;
    }
    
    // MIDI
    if (typeof MIDIAccess !== 'undefined' && val instanceof MIDIAccess) {
      transferables.push(val);
      return;
    }
    
    // Media Source
    if (typeof MediaSourceHandle !== 'undefined' && val instanceof MediaSourceHandle) {
      transferables.push(val);
      return;
    }
    
    // NOTE: TypedArrays (Uint8Array, Int32Array, etc.) are NOT transferred by default
    // They are efficiently handled by the structured clone algorithm
    // If you want to transfer the underlying buffer, use a custom getTransferables function
    
    // Recursively check arrays and objects for transferable content
    if (Array.isArray(val)) {
      val.forEach(collectTransferables);
    } else if (isPlainObject(val)) {
      Object.values(val).forEach(collectTransferables);
    }
  }
  
  collectTransferables(value);
  
  // Remove duplicates
  return Array.from(new Set(transferables));
}

/**
 * Creates a transferables detector function that combines validation and detection
 */
export type TransferHandler = ReturnType<typeof createTransferHandler>;

export function createTransferHandler(getTransferables: GetTransferablesFn = defaultGetTransferables) {
  return {
    validate: validateTransferableValue,
    getTransferables: (value: any) => {
      validateTransferableValue(value);
      return getTransferables(value);
    }
  };
}
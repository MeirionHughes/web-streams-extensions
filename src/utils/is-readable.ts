export function isReadableStream(obj): obj is ReadableStream {
  if(obj.getReader != undefined){
    return true;
  }
  return false;
}
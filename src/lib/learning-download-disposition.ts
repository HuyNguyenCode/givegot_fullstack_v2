export function downloadContentDisposition(fileName: string) {
  const safeName = fileName.normalize('NFC').replace(/[\x00-\x1f\x7f-\x9f]/gu, '') || 'download'
  const fallback = safeName.replace(/[^\x20-\x7e]|["\\]/gu, '_') || 'download'
  const encoded = encodeURIComponent(safeName).replace(/[!'()*]/gu, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

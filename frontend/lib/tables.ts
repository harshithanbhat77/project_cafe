/** The page a table's QR code opens. Uses this site's own address, so it works on any domain. */
export function guestUrl(table: { qr_token: string }): string {
  return `${window.location.origin}/order/${table.qr_token}`
}

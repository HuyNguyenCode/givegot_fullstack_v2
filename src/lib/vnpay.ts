/**
 * VNPay Payment Gateway Utilities
 *
 * Implements URL generation and HMAC-SHA512 signature for VNPay API v2.1.0.
 * Reference: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
 *
 * Key rules:
 *  - Params are sorted alphabetically by key before signing.
 *  - Signature is computed over the RAW (non-URL-encoded) query string.
 *  - The final URL uses percent-encoded values for safe HTTP transport.
 *  - vnp_Amount = amountVND × 100 (VNPay uses VND × 100 to avoid decimals).
 */

import crypto from 'crypto'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VNPayCreateParams {
  userId: string
  txnRef: string       // Our TransactionLog.id — sent as vnp_TxnRef
  amountVND: number    // Human-readable VND (e.g. 100000)
  orderInfo: string    // Short description shown on VNPay checkout
  clientIp: string
}

export interface VNPayIpnParams {
  vnp_TmnCode: string
  vnp_Amount: string
  vnp_BankCode: string
  vnp_BankTranNo?: string
  vnp_CardType?: string
  vnp_PayDate: string
  vnp_OrderInfo: string
  vnp_TransactionNo: string
  vnp_ResponseCode: string
  vnp_TransactionStatus: string
  vnp_TxnRef: string
  vnp_SecureHash: string
  vnp_SecureHashType?: string
  [key: string]: string | undefined
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Sort an object's keys alphabetically — required by VNPay before signing.
 */
// function sortKeys(
//   obj: Record<string, string | number>,
// ): Record<string, string | number> {
//   return Object.keys(obj)
//     .sort()
//     .reduce<Record<string, string | number>>((acc, key) => {
//       acc[key] = obj[key]
//       return acc
//     }, {})
// }

/**
 * Build the string that gets fed into HMAC-SHA512.
 * VNPay signs raw (un-encoded) `key=value` pairs joined with `&`.
 */
// function toSignString(sorted: Record<string, string | number>): string {
//   return Object.entries(sorted)
//     .map(([k, v]) => `${k}=${v}`)
//     .join('&')
// }

/**
 * Build a URL-safe query string for appending to the payment URL.
 */
// function toQueryString(sorted: Record<string, string | number>): string {
//   return Object.entries(sorted)
//     .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
//     .join('&')
// }


/**
 * Compute HMAC-SHA512 hex digest.
 */
// function hmacSHA512(data: string, secret: string): string {
//   return crypto.createHmac('sha512', secret).update(data, 'utf8').digest('hex')
// }

// ── Helpers Chuẩn VNPay v2.1.0 ──────────────────────────────────────────────

/**
 * Hàm này vừa sắp xếp alphabet, vừa URL Encode giá trị, vừa đổi dấu cách thành '+'
 * theo đúng đặc tả kỹ thuật khắt khe của hệ thống ngân hàng.
 */
function buildSortedSignData(obj: Record<string, string | number>): string {
  const sortedKeys = Object.keys(obj).sort()
  const signDataArr: string[] = []
  
  for (const key of sortedKeys) {
    const value = obj[key]
    if (value !== '' && value !== undefined && value !== null) {
      // Bắt buộc Encode và thay khoảng trắng thành dấu '+'
      const encodedValue = encodeURIComponent(String(value)).replace(/%20/g, '+')
      signDataArr.push(`${key}=${encodedValue}`)
    }
  }
  
  return signDataArr.join('&')
}

/**
 * Compute HMAC-SHA512 hex digest.
 */
function hmacSHA512(data: string, secret: string): string {
  return crypto.createHmac('sha512', secret).update(data, 'utf8').digest('hex')
}

// ... (Giữ nguyên hàm formatVNPayDate của Claude vì nó viết rất đúng giờ UTC+7) ...

/**
 * Format a Date as `yyyyMMddHHmmss` in Vietnam Standard Time (UTC+7).
 * VNPay requires this exact format for vnp_CreateDate and vnp_ExpireDate.
 */
export function formatVNPayDate(date: Date = new Date()): string {
  // Shift to UTC+7
  const vn = new Date(date.getTime() + 7 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return [
    vn.getUTCFullYear(),
    pad(vn.getUTCMonth() + 1),
    pad(vn.getUTCDate()),
    pad(vn.getUTCHours()),
    pad(vn.getUTCMinutes()),
    pad(vn.getUTCSeconds()),
  ].join('')
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a signed VNPay checkout URL ready for browser redirect.
 *
 * @returns The full HTTPS URL including the vnp_SecureHash parameter.
 */
export function buildVNPayUrl({
  userId: _userId,
  txnRef,
  amountVND,
  orderInfo,
  clientIp,
}: VNPayCreateParams): string {
  const tmnCode  = process.env.VNP_TMNCODE   ?? ''
  const secret   = process.env.VNP_HASHSECRET ?? ''
  const baseUrl  = process.env.VNP_URL        ?? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'
  const returnUrl = process.env.VNP_RETURNURL ?? 'http://localhost:3000/api/vnpay/return'

  const now = new Date()
  const createDate = formatVNPayDate(now)
  // Order expires after 15 minutes
  const expireDate = formatVNPayDate(new Date(now.getTime() + 15 * 60 * 1000))

  const params: Record<string, string | number> = {
    vnp_Version:    '2.1.0',
    vnp_Command:    'pay',
    vnp_TmnCode:    tmnCode,
    vnp_Amount:     amountVND * 100,   // VNPay uses VND × 100
    vnp_CurrCode:   'VND',
    vnp_TxnRef:     txnRef,
    vnp_OrderInfo:  orderInfo,
    vnp_OrderType:  'other',
    vnp_Locale:     'vn',
    vnp_ReturnUrl:  returnUrl,
    vnp_IpAddr:     clientIp,
    vnp_CreateDate: createDate,
    vnp_ExpireDate: expireDate,
  }

  // const sorted    = sortKeys(params)
  // const signData  = toSignString(sorted)
  // const signature = hmacSHA512(signData, secret)

  // return `${baseUrl}?${toQueryString(sorted)}&vnp_SecureHash=${signature}`
  // 1. Tạo chuỗi đã encode và sort
  const signData = buildSortedSignData(params)
  
  // 2. Băm chuỗi đó bằng HASHSECRET
  const signature = hmacSHA512(signData, secret)

  // 3. Nối signature vào cuối
  return `${baseUrl}?${signData}&vnp_SecureHash=${signature}`
}

/**
 * Verify the HMAC-SHA512 signature on an IPN or return-URL callback from VNPay.
 *
 * @param params   All query params received from VNPay (as string key-value pairs).
 * @returns `true` if the computed hash matches `vnp_SecureHash`.
 */
// export function verifyVNPaySignature(params: Record<string, string>): boolean {
//   const secret = process.env.VNP_HASHSECRET ?? ''

//   const { vnp_SecureHash, vnp_SecureHashType, ...rest } = params
//   // Suppress unused-var warnings — we intentionally strip these before signing
//   void vnp_SecureHashType

//   if (!vnp_SecureHash) return false

//   const sorted    = sortKeys(rest as Record<string, string>)
//   const signData  = toSignString(sorted)
//   const computed  = hmacSHA512(signData, secret)

//   // Use timingSafeEqual to prevent timing-based hash comparison attacks
//   try {
//     return crypto.timingSafeEqual(
//       Buffer.from(computed,       'hex'),
//       Buffer.from(vnp_SecureHash, 'hex'),
//     )
//   } catch {
//     return false
//   }
// }
export function verifyVNPaySignature(params: Record<string, string>): boolean {
  const secret = process.env.VNP_HASHSECRET ?? ''
  const { vnp_SecureHash, vnp_SecureHashType, ...rest } = params
  
  if (!vnp_SecureHash) return false

  // Dùng lại đúng hàm encode ở trên để tạo chuỗi kiểm tra
  const signData = buildSortedSignData(rest)
  const computed = hmacSHA512(signData, secret)

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(vnp_SecureHash, 'hex'),
    )
  } catch {
    return false
  }
}

export function extractOtps(text: string): string | null {
    const keyword = /(?:code|kode|otp|verification|passcode)\D{0,30}(\d{4,8})\b/i;
    const match = text.match(keyword);
    return match ? match[1] : null; 
}
/**
 * SMART PRODUCT CODE EXTRACTOR
 * Professional pharma QR codes often contain batch, expiry, and GTIN mixed with labels.
 * This helper isolates the Part Number / GTIN / SKU.
 */
export const extractProductCode = (rawScan: string): string => {
    if (!rawScan) return "";
    let cleaned = rawScan.trim();

    // 1. Handle GS1 Datamatrix / GS1-128 (Pharma Standard)
    // Looking for AI (01) which is GTIN
    if (cleaned.includes('(01)') || cleaned.startsWith('01')) {
        const gtinMatch = cleaned.match(/(?:\(01\)|01)(\d{13,14})/);
        if (gtinMatch) return gtinMatch[1];
    }

    // 2. Handle URL wrappers (Common for vendor portals)
    try {
        if (cleaned.startsWith('http')) {
            const url = new URL(cleaned);
            const idParam = url.searchParams.get('id') || url.searchParams.get('code') || url.searchParams.get('p') || url.searchParams.get('sku');
            if (idParam) return idParam;
            const segments = url.pathname.split('/').filter(Boolean);
            if (segments.length > 0) return segments[segments.length - 1];
        }
    } catch (e) {}

    // 3. Handle Labelled Strings (Regex for "PN", "Part No", "SKU", "Ref")
    // This handles "Some company have qrcode in between part no text"
    const labelPatterns = [
        /(?:part\s*no|p\/n|sku|ref|code|item|id|pn)[:\s-]+([a-z0-9-]+)/i,
        /\bPN[:\s]*([A-Z0-9-]+)\b/i,
        /([0-9]{8,14})/ // Any sequence of 8-14 digits (likely EAN/UPC/GTIN)
    ];

    for (const pattern of labelPatterns) {
        const match = cleaned.match(pattern);
        if (match && match[1]) return match[1];
    }

    // 4. Word-based Extraction (Aggressive)
    // Split by common delimiters and find the "most likely" code
    const words = cleaned.split(/[\s,;|]+/);
    for (const word of words) {
        // Alphanumeric with at least one number and one letter, 4-20 chars
        if (/^(?=.*[0-9])(?=.*[a-z])[a-z0-9-]{4,20}$/i.test(word)) {
            return word;
        }
    }

    // 5. Fallback: First segment, cleaned of symbols
    return words[0].replace(/[^a-z0-9-]/gi, '');
};

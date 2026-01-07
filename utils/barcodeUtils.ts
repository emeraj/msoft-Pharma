
/**
 * Advanced Parser for industrial/retail QR codes.
 * Extracts the Part Number / SKU from a string containing multiple details.
 * Example Input: "ID:123;PART:NICIP-PLUS;QTY:10;EXP:2025-12"
 * Example Output: "NICIP-PLUS"
 */
export const extractPartNumber = (raw: string): string => {
    if (!raw) return "";

    // 1. Check if it's a JSON string
    if (raw.startsWith('{') && raw.endsWith('}')) {
        try {
            const data = JSON.parse(raw);
            const partNo = data.part_no || data.partNo || data.pn || data.part || data.sku || data.code;
            if (partNo) return String(partNo).trim();
        } catch (e) {
            // Not valid JSON, proceed to text parsing
        }
    }

    // 2. Split by common delimiters (semicolon, pipe, comma, newline, or space)
    const segments = raw.split(/[;|, \n\r]+/);

    // 3. Look for segments with known "Part Number" prefixes
    for (const segment of segments) {
        const cleanSegment = segment.trim();
        // Regex to catch PART:value, P/N:value, PN:value, SKU:value, CODE:value
        const match = cleanSegment.match(/^(?:PART|P\/N|PN|SKU|CODE|REF)[:\- ]*(.+)$/i);
        if (match && match[1]) {
            return match[1].trim();
        }
    }

    // 4. Fallback: If we have multiple segments but no prefix, 
    // and one segment looks particularly like a part number (alphanumeric with hyphens/dots)
    if (segments.length > 1) {
        for (const segment of segments) {
            const s = segment.trim();
            // A typical part number usually isn't just numbers (that's likely an ID or QTY)
            // and usually contains letters and numbers or symbols
            if (s.length > 3 && /[A-Z]/.test(s.toUpperCase()) && /[0-9]/.test(s)) {
                return s;
            }
        }
        // If nothing matches the "smart" check, return the first segment as it's often the ID/Part
        return segments[0].trim();
    }

    // 5. Absolute Fallback: Return raw trimmed string
    return raw.trim();
};

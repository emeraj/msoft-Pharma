
/**
 * Utility to extract part numbers or product codes from raw scanner data.
 * Specifically handles industrial VDA/Automotive QR formats where data is segmented by '/'.
 */
export const extractPartNumber = (rawCode: string): string => {
  if (!rawCode) return "";
  
  // Format Example: D/FJWG0000221228/JCF5RFQPN2JD/17681KWA940S /000005/0000017.00/AAB/1/G/000/00
  // The part number is specifically the 4th segment (index 3)
  if (rawCode.includes('/')) {
    const segments = rawCode.split('/');
    if (segments.length >= 4) {
      return segments[3].trim();
    }
  }
  
  // Fallback for standard barcodes
  return rawCode.trim();
};

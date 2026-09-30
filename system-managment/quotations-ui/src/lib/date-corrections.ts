export const DATE_CORRECTION_REASONS = [
    'WRONG_DATE_ENTERED',
    'RECORDING_ERROR',
    'CLIENT_DELAYED',
    'DATA_MIGRATION',
    'OTHER',
] as const

export type DateCorrectionReason = (typeof DATE_CORRECTION_REASONS)[number]

export function dateCorrectionReasonLabel(value: string): string {
    return value.replace(/_/g, ' ')
}
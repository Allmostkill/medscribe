import bcrypt from "bcryptjs";

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function isValidEmail(v: string): boolean {
  return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function toPublicDoctor(row: any) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    specialtyId: row.specialtyId,
    experienceYears: row.experienceYears,
    protocolTemplate: row.protocol_template ?? '',
    isTwoFactorEnabled: !!row.is_two_factor_enabled,
  };
}

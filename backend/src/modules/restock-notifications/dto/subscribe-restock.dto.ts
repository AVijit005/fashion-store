import { IsEmail, IsUUID, MaxLength } from "class-validator";

/**
 * Subscribe to a back-in-stock notification for a specific variant.
 * Idempotent: repeat submissions with the same email + variantId are
 * silently deduped (unique index on variantId+email).
 */
export class SubscribeRestockDto {
  @IsUUID()
  variantId!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;
}

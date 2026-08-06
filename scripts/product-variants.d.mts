export interface ProductVariant {
  readonly key: "prompterpro" | "simpleprompt";
  readonly productName: "PrompterPro" | "SimplePrompt";
  readonly applicationId: string;
  readonly description: string;
  readonly backgroundColor: string;
  readonly store: Readonly<{
    identityName: string;
    publisher: string;
    publisherDisplayName: string;
    productId: string;
    packageFamilyName?: string;
    packageSid?: string;
  }>;
}

export const PRODUCT_VARIANTS: Readonly<
  Record<"prompterpro" | "simpleprompt", ProductVariant>
>;

export function getProductVariant(value?: string): ProductVariant;

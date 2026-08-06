const sharedPublisher = Object.freeze({
  publisher: "CN=E3BDC624-0B0A-4256-85B0-5AE714EA8897",
  publisherDisplayName: "Released Pty Ltd",
});

export const PRODUCT_VARIANTS = Object.freeze({
  prompterpro: Object.freeze({
    key: "prompterpro",
    productName: "PrompterPro",
    applicationId: "Prompter",
    description:
      "An offline, voice-following teleprompter for polished video recording.",
    backgroundColor: "#0b0d0f",
    store: Object.freeze({
      ...sharedPublisher,
      identityName: "ReleasedPtyLtd.PrompterPro",
      productId: "",
    }),
  }),
  simpleprompt: Object.freeze({
    key: "simpleprompt",
    productName: "SimplePrompt",
    applicationId: "SimplePrompt",
    description:
      "A private, voice-following teleprompter for clear video recording.",
    backgroundColor: "#0b0d0f",
    store: Object.freeze({
      ...sharedPublisher,
      identityName: "ReleasedPtyLtd.SimplePrompt",
      productId: "9MT1X5BNTHQS",
      packageFamilyName: "ReleasedPtyLtd.SimplePrompt_q0b077qanz1d8",
      packageSid:
        "S-1-15-2-2676728462-2596204801-2700890954-455437082-720273692-286854053-1939976512",
    }),
  }),
});

export function getProductVariant(value = "prompterpro") {
  const key = value.trim().toLowerCase();
  const variant = PRODUCT_VARIANTS[key];
  if (!variant) {
    throw new Error(
      `Unknown product variant "${value}". Expected prompterpro or simpleprompt.`,
    );
  }
  return variant;
}

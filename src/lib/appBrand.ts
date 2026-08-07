export type AppVariant = "prompterpro" | "simpleprompt";

const requestedVariant = import.meta.env.VITE_APP_VARIANT?.toLowerCase();

export const appVariant: AppVariant =
  requestedVariant === "simpleprompt" ? "simpleprompt" : "prompterpro";

export const appBrand = Object.freeze(
  appVariant === "simpleprompt"
    ? {
        name: "SimplePrompt",
        icon: "/simpleprompt-mark.svg",
      }
    : {
        name: "PrompterPro",
        icon: "/prompter-mark.svg",
      },
);

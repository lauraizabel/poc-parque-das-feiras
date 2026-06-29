import { RenderedEmail, TemplateRenderer, TemplateVariables } from "./base-layout";

const registry = new Map<string, TemplateRenderer>();

export function registerTemplate(key: string, renderer: TemplateRenderer): void {
  registry.set(key, renderer);
}

export function renderTemplate(
  key: string,
  variables: TemplateVariables
): RenderedEmail | null {
  const renderer = registry.get(key);
  if (!renderer) {
    return null;
  }
  return renderer(variables);
}

export function hasTemplate(key: string): boolean {
  return registry.has(key);
}

export function listTemplateKeys(): string[] {
  return Array.from(registry.keys());
}

// Auto-register all templates
const templateModules: Record<string, () => TemplateRenderer> = {
  "auth-email-verification": () => require("./auth-email-verification").render,
  "auth-password-reset": () => require("./auth-password-reset").render,
  "payment-approved-customer": () => require("./payment-customer").render,
  "payment-approved-store": () => require("./payment-store").render,
  "payment-failed-customer": () => require("./payment-customer").render,
  "payment-failed-store": () => require("./payment-store").render,
  "payment-expired-customer": () => require("./payment-customer").render,
  "payment-expired-store": () => require("./payment-store").render,
  "payment-refunded-customer": () => require("./payment-customer").render,
  "payment-refunded-store": () => require("./payment-store").render,
  "order-created-customer": () => require("./order-created-customer").render,
  "order-created-store": () => require("./order-created-store").render,
  "domain-activated": () => require("./domain-activated").render
};

for (const [key, loader] of Object.entries(templateModules)) {
  try {
    const renderer = loader();
    registerTemplate(key, renderer);
  } catch {
    // Template module not available yet — skip registration
  }
}

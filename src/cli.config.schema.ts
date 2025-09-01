/**
 * @file JSON Schema definition for CliConfig validation
 */

// Define schema without strict type checking due to ajv's complex union type handling
export const cliConfigSchema = {
  type: "object",
  properties: {
    port: {
      type: "number",
      nullable: true,
    },
    persistRoot: {
      type: "string",
      nullable: true,
    },
    ignore: {
      type: "array",
      items: {
        type: "string",
      },
      nullable: true,
    },
    ui: {
      type: "boolean",
      nullable: true,
    },
    llm: {
      type: "object",
      properties: {
        apiKey: {
          type: "string",
          nullable: true,
        },
        apiKeyEnv: {
          type: "string",
          nullable: true,
        },
        model: {
          type: "string",
          nullable: true,
        },
        instruction: {
          type: "string",
          nullable: true,
        },
        textInstruction: {
          type: "string",
          nullable: true,
        },
        imageInstruction: {
          type: "string",
          nullable: true,
        },
      },
      nullable: true,
      additionalProperties: false,
    },
    image: {
      type: "object",
      properties: {
        provider: {
          type: "string",
          enum: ["openai", "nanobanana"],
        },
        openai: {
          type: "object",
          properties: {
            baseUrl: {
              type: "string",
              nullable: true,
            },
            model: {
              type: "string",
            },
            apiKey: {
              type: "string",
              nullable: true,
            },
            apiKeyEnv: {
              type: "string",
              nullable: true,
            },
            organization: {
              type: "string",
              nullable: true,
            },
            project: {
              type: "string",
              nullable: true,
            },
          },
          required: ["model"],
          additionalProperties: false,
          nullable: true,
        },
        nanobanana: {
          type: "object",
          properties: {
            baseUrl: {
              type: "string",
            },
            model: {
              type: "string",
            },
            apiKey: {
              type: "string",
              nullable: true,
            },
            apiKeyEnv: {
              type: "string",
              nullable: true,
            },
          },
          required: ["baseUrl", "model"],
          additionalProperties: false,
          nullable: true,
        },
      },
      required: ["provider"],
      additionalProperties: false,
      nullable: true,
    },
  },
  additionalProperties: false,
} as const;
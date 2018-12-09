"use strict";
const semver = require("semver");
const PLUGIN_NAME = "serverless-resource-policy";
const BASE_POLICY = {
  Effect: "Allow",
  Principal: "*",
  Action: "execute-api:Invoke",
  Resource: ["execute-api:/*/*/*"]
};

class ServerlessPlugin {
  constructor(serverless, options) {
    console.log(`Starting serverless-resource-policy`);

    if (!semver.satisfies(serverless.version, ">= 1.12")) {
      throw new Error(
        "serverless-plugin-custom-roles requires serverless 1.12 or higher!"
      );
    }
    let config = {};
    if (serverless.service.custom && serverless.service.custom[PLUGIN_NAME]) {
      config = serverless.service.custom[PLUGIN_NAME];
    }

    const hooks = {
      "before:offline:start": () => this.createResourcePolicy(config, true), // For testing the resource policy
      "package:initialize": () => this.createResourcePolicy(config)
    };

    Object.assign(this, {
      serverless,
      options,
      hooks,
      resourcePolicy: null,
      provider: serverless.getProvider("aws")
    });
  }

  createResourcePolicy(config, inDevMode = false) {
    if (config && JSON.stringify(config) !== "{}") {
      const { stage, publicStages, privateStages, netblocks } = config;
      this.serverless.cli.log(`Creating resource policies for ${stage} stage`);

      // If the currently selected stage is a public stage, then
      if (publicStages && publicStages.length && ~publicStages.indexOf(stage)) {
        this.serverless.cli.log(
          `Public Resource policy required for ${stage} stage`
        );
        this.resourcePolicy = Object.assign({}, BASE_POLICY);
      } else {
        if (!netblocks) {
          throw new Error(
            `[${PLUGIN_NAME}]: The \`netblocks\` option is required when specifying public stages (all other stages will be restricted)`
          );
        }

        let ipRanges = netblocks;
        if (!ipRanges || ipRanges.length === 0) {
          throw new Error(
            `[${PLUGIN_NAME}]: Could not determine IP range restriction for ${stage} stage. Please check your config.`
          );
        }

        this.serverless.cli.log(
          `Private Resource policy required for ${stage} stage`
        );

        this.resourcePolicy = Object.assign(
          {
            Condition: {
              IpAddress: {
                "aws:SourceIp": netblocks
              }
            }
          },
          BASE_POLICY
        );
      }

      // Assign resource policy update
      const resourcePolicyUpdate = {
        resourcePolicy: [this.resourcePolicy]
      };

      if (!inDevMode) {
        Object.assign(this.serverless.service.provider, resourcePolicyUpdate);
      } else {
        this.serverless.cli.log(JSON.stringify(resourcePolicyUpdate));
      }
    }
  }
}

module.exports = ServerlessPlugin;

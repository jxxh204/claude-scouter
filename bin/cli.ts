#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "../src/commands/init.js";
import { doctorCommand } from "../src/commands/doctor.js";
import { updateCommand } from "../src/commands/update.js";

const program = new Command();

program
  .name("claude-scouter")
  .description(
    "Opinionated Claude Code project bootstrapper — CLAUDE.md, skills, hooks, agents, PR/commit conventions"
  )
  .version("0.1.0");

program
  .command("init")
  .description("Interactive setup for Claude Code project configuration")
  .option("-y, --yes", "Accept all defaults")
  .action(initCommand);

program
  .command("doctor")
  .description("Health check for Claude Code project configuration")
  .action(doctorCommand);

program
  .command("update")
  .description("Update generated files while preserving user modifications")
  .action(updateCommand);

program.parse();

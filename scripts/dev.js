#!/usr/bin/env node

import 'dotenv/config'; // Ensure dotenv loads environment variables first

/**
 * dev.js
 * Task Master CLI - AI-driven development task management
 * 
 * This is the refactored entry point that uses the modular architecture.
 * It imports functionality from the modules directory and provides a CLI.
 */

import { runCLI } from './modules/commands.js';

// Run the CLI with the process arguments
runCLI(process.argv); 
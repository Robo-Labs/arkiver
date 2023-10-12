#!/usr/bin/env bun
import { Command } from 'commander';
import pkg from "./package.json"
import { dev } from './src/cli/dev';

const program = new Command();

program
	.name('arkiver')
	.description(pkg.description)
	.version(pkg.version);

program
	.command('dev')
	.description('Run the Arkiver in development mode')
	.action(dev);

program.parseAsync()
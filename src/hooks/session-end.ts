#!/usr/bin/env node
import { runHook } from './run-hook.js';

await runHook('SessionEnd');

/**
 * Runs before tests/preload.ts so JSDOM globals exist before mocks and any module
 * that may load @react-aria/interactions at init time.
 */
import { installTestJsdom } from "./helpers/install-test-jsdom";

installTestJsdom();

import "fake-indexeddb/auto";

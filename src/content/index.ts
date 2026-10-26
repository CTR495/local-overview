import { OverviewController } from './controller';
const key = '__localOverviewController_v1__';
// Guard both repeated injection and extension updates in the isolated world.
const scope = globalThis as typeof globalThis & { [key]?: OverviewController };
scope[key]?.destroy();
const controller = new OverviewController();
scope[key] = controller;
void controller.start().catch((error) => {
  controller.destroy();
  console.warn(
    'Local Overview could not start:',
    error instanceof Error ? error.message : 'extension unavailable',
  );
});

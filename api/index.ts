// @ts-ignore
import serverModule from '../dist/server.cjs';

const app = serverModule.default || serverModule.app || serverModule;

export default app;

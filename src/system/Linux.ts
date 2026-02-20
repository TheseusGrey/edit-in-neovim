import * as os from "node:os";
import { delimiter, normalize } from "node:path";
import { SpawnProcessOptions } from "src/utils";
import Host from "./Host";

export class Linux extends Host {

  configureHostArgs(neovimPath: string, defaults: SpawnProcessOptions): SpawnProcessOptions {
    console.debug(`edit-in-neovim:\nProcess spawn config for Linux: ${JSON.stringify(defaults, null, 2)}`)
    return {
      ...defaults,
      spawnArgs: ["-e", neovimPath, "--listen", this.settings.listenOn],
      shell: os.userInfo().shell || true,
    };
  }

  getSearchPaths(): Set<string> {
    const paths = new Set<string>();
    const { PATH, HOME } = process.env;

    PATH?.split(delimiter).forEach(p => paths.add(normalize(p)));

    if (HOME) {
      paths.add(normalize(`${HOME}/bin`));
      paths.add(normalize(`${HOME}/.linuxbrew/bin`));
    }

    return paths;
  }
}

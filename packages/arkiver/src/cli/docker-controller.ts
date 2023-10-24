import Docker from "dockerode";

// TODO: blocked by https://github.com/oven-sh/bun/issues/2734
export class DockerController {
  #docker: Docker;

  constructor() {
    this.#docker = new Docker({ socketPath: "/var/run/docker.sock" });
  }

  async run(
    image: string,
    cmd?: string[],
    createOptions?: Docker.ContainerCreateOptions,
    startOptions?: Docker.ContainerStartOptions
  ) {
    const container = await this.#docker.run(
      image,
      cmd ?? [],
      process.stdout,
      createOptions,
      startOptions
    );

    console.log(container);
  }
}

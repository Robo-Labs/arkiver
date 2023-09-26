import { ViemDataProvider } from "./data-provider";
import { PublicClient } from "viem";
import { describe, beforeEach, jest, expect, it } from "bun:test";

describe("ViemDataProvider", () => {
  let client: PublicClient;
  let dataProvider: ViemDataProvider;

  beforeEach(() => {
    client = {
      getLogs: jest.fn(),
      getBlock: jest.fn(),
      getBlockNumber: jest.fn(),
    } as unknown as PublicClient;

    dataProvider = new ViemDataProvider({ client });
  });

  describe("fetchSpecificLogs", () => {
    it("should return empty array if no addresses are provided", async () => {
      const result = await dataProvider.fetchSpecificLogs({
        startBlock: 0n,
        endBlock: 100n,
        contracts: [
          {
            sources: {},
            abiEvents: [],
          },
        ],
      });

      expect(result).toEqual([]);
    });

    it("should return logs for provided addresses and events", async () => {
      (client.getLogs as jest.Mock).mockResolvedValueOnce([]);

      const result = await dataProvider.fetchSpecificLogs({
        startBlock: 0n,
        endBlock: 100n,
        contracts: [
          {
            sources: {
              "0x123": 0n,
            },
            abiEvents: [
              {
                name: "Event1",
                inputs: [],
                type: "event",
              },
            ],
          },
        ],
      });

      expect(client.getLogs).toHaveBeenCalled();

      expect(result).toEqual([]);
    });
  });

  describe("fetchWildcardLogs", () => {
    it("should return empty array if no events are provided", async () => {
      const result = await dataProvider.fetchWildcardLogs({
        startBlock: 0n,
        endBlock: 100n,
        sources: [
          {
            startBlock: 0n,
            abiEvents: [],
          },
        ],
      });

      expect(result).toEqual([]);
    });

    it("should return logs for provided events", async () => {
      (client.getLogs as jest.Mock).mockResolvedValueOnce([]);

      const result = await dataProvider.fetchWildcardLogs({
        startBlock: 0n,
        endBlock: 100n,
        sources: [
          {
            startBlock: 0n,
            abiEvents: [
              {
                name: "Event1",
                inputs: [],
                type: "event",
              },
            ],
          },
        ],
      });

      expect(client.getLogs).toHaveBeenCalled();

      expect(result).toEqual([]);
    });
  });

  describe("fetchBlocks", () => {
    it("should return empty array if no blocks are within range", async () => {
      const result = await dataProvider.fetchBlocks({
        startBlock: 10n,
        endBlock: 20n,
        sources: [
          {
            startBlock: 30n,
            interval: 5n,
          },
        ],
      });

      expect(result).toEqual([]);
    });

    it("should return blocks within range", async () => {
      (client.getBlock as jest.Mock).mockResolvedValueOnce({ number: 10n });
      (client.getBlock as jest.Mock).mockResolvedValueOnce({ number: 15n });
      (client.getBlock as jest.Mock).mockResolvedValueOnce({ number: 20n });

      const result = await dataProvider.fetchBlocks({
        startBlock: 10n,
        endBlock: 20n,
        sources: [
          {
            startBlock: 5n,
            interval: 5n,
          },
          {
            startBlock: 15n,
            interval: 5n,
          },
        ],
      });

      expect(client.getBlock).toHaveBeenCalled();
      expect(client.getBlock).toHaveBeenCalled();
      expect(client.getBlock).toHaveBeenCalled();

      expect(result).toEqual([
        { number: 10n },
        { number: 15n },
        { number: 20n },
      ]);
    });
  });

  describe("fetchLatestBlock", () => {
    it("should return latest block number", async () => {
      (client.getBlockNumber as jest.Mock).mockResolvedValueOnce(100n);

      const result = await dataProvider.fetchLatestBlock();

      expect(client.getBlockNumber).toHaveBeenCalled();
      expect(result).toEqual(100n);
    });
  });
});

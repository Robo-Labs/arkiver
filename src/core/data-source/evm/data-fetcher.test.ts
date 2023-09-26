import pino from "pino";
import { EvmDataBroker } from "./data-broker";
import { EvmDataFetcher } from "./data-fetcher";
import { describe, beforeEach, jest, expect, it, spyOn } from "bun:test";

describe("EvmDataFetcher", () => {
  let evmDataFetcher: EvmDataFetcher<{}>;

  beforeEach(() => {
    // Initialize a new instance of EvmDataFetcher before each test
    evmDataFetcher = new EvmDataFetcher({
      dataBroker: new EvmDataBroker(),
      dataSourceManifest: {
        blockHandlers: [],
        contracts: {},
        options: {
          blockRange: 1n,
          rpcUrls: [],
        },
      },
      logger: { info: () => {}, error: () => {}, debug: () => {} } as any,
      dataProvider: {
        fetchLatestBlock: jest.fn(),
        fetchSpecificLogs: jest.fn(),
        fetchWildcardLogs: jest.fn(),
        fetchBlocks: jest.fn(),
      } as any,
      chain: "test",
      dbProvider: {} as any,
    });
  });

  describe("startBatchProcess", () => {
    it("should call processBlock the correct amount of times", async () => {
      // Mock the processBlock method
      const processBlock = spyOn(
        evmDataFetcher,
        "processBlock"
      ).mockResolvedValue(undefined);
      evmDataFetcher.state.latestBlock = 10n;

      // Call the startBatchProcessing method with some test arguments
      await evmDataFetcher.startBatchProcess(1n);

      // Expect the processBlock method to have been called the correct amount of times
      expect(processBlock).toHaveBeenCalledTimes(10);
    });
  });

  describe("processBlock", () => {
    it("should call the fetchSpecificLogs, fetchWildcardLogs, and fetchBlocks methods with the correct arguments", async () => {
      // Mock the fetchSpecificLogs, fetchWildcardLogs, and fetchBlocks methods
      const fetchSpecificLogs = spyOn(
        evmDataFetcher.dataProvider,
        "fetchSpecificLogs"
      ).mockResolvedValueOnce([]);
      const fetchWildcardLogs = spyOn(
        evmDataFetcher.dataProvider,
        "fetchWildcardLogs"
      ).mockResolvedValueOnce([]);
      const fetchBlocks = spyOn(
        evmDataFetcher.dataProvider,
        "fetchBlocks"
      ).mockResolvedValueOnce([]);

      // Call the processBlock method with some test arguments
      await evmDataFetcher.processBlock(1n, 2n);

      // Expect the fetchSpecificLogs, fetchWildcardLogs, and fetchBlocks methods to have been called with the correct arguments
      expect(fetchSpecificLogs).toHaveBeenCalled();
      expect(fetchWildcardLogs).toHaveBeenCalled();
      expect(fetchBlocks).toHaveBeenCalled();
    });

    it("should call the sendData method with the correct arguments", async () => {
      // Mock the fetchSpecificLogs, fetchWildcardLogs, and fetchBlocks methods to return some test data
      spyOn(
        evmDataFetcher.dataProvider,
        "fetchSpecificLogs"
      ).mockResolvedValueOnce([{ log: "test" } as any]);
      spyOn(
        evmDataFetcher.dataProvider,
        "fetchWildcardLogs"
      ).mockResolvedValueOnce([{ log: "test" } as any]);
      spyOn(evmDataFetcher.dataProvider, "fetchBlocks").mockResolvedValueOnce([
        { block: "test" } as any,
      ]);

      // Mock the sendData method
      const sendData = spyOn(evmDataFetcher.dataBroker, "sendData");

      // Call the processBlock method with some test arguments
      await evmDataFetcher.processBlock(1n, 2n);

      // Expect the sendData method to have been called with the correct arguments
      expect(sendData).toHaveBeenCalled();
    });
  });

  describe("loadContracts", () => {
    it("should add sources to the wildcard log sources if the contract has a wildcard source", () => {
      // Mock the state.latestBlock property
      evmDataFetcher.state.latestBlock = 10n;

      // Set up a test contract with a wildcard source
      evmDataFetcher.contracts = {
        testContract: {
          abi: [],
          events: {},
          sources: {
            "*": "live",
          },
          factorySources: {},
          id: "testContract",
        },
      };

      // Call the loadContracts method
      const result = evmDataFetcher.loadContracts();

      // Expect the wildcard log sources to have been added with the correct arguments
      expect(evmDataFetcher.sources.wildcard).toEqual([
        {
          startBlock: 10n,
          abiEvents: [],
        },
      ]);

      // Expect the loadContracts method to return the correct value
      expect(result).toBe(10n);
    });

    it("should add sources to the specific log sources if the contract has specific sources", () => {
      // Mock the state.latestBlock property
      evmDataFetcher.state.latestBlock = 10n;

      // Set up a test contract with specific sources
      evmDataFetcher.contracts = {
        testContract: {
          abi: [],
          events: {},
          sources: {
            "0x123": 5n,
            "0x456": "live",
          },
          factorySources: {},
          id: "testContract",
        },
      };

      // Call the loadContracts method
      const result = evmDataFetcher.loadContracts();

      // Expect the specific log sources to have been added with the correct arguments
      expect(evmDataFetcher.sources.specific).toEqual([
        {
          sources: {
            "0x123": 5n,
            "0x456": 10n,
          },
          abiEvents: [],
        },
      ]);

      // Expect the loadContracts method to return the correct value
      expect(result).toBe(5n);
    });
  });

  describe("loadBlocks", () => {
    it("should add sources to the block sources", () => {
      // Mock the state.latestBlock property
      evmDataFetcher.state.latestBlock = 10n;

      // Set up some test block handlers
      evmDataFetcher.blockHandlers = [
        {
          blockInterval: 100n,
          startBlockHeight: 5n,
          handler: () => {},
          name: "test",
        },
        {
          blockInterval: 200n,
          startBlockHeight: "live",
          handler: () => {},
          name: "test",
        },
      ];

      // Call the loadBlocks method
      const result = evmDataFetcher.loadBlocks();

      // Expect the block sources to have been added with the correct arguments
      expect(evmDataFetcher.sources.blocks).toEqual([
        {
          interval: 100n,
          startBlock: 5n,
        },
        {
          interval: 200n,
          startBlock: 10n,
        },
      ]);

      // Expect the loadBlocks method to return the correct value
      expect(result).toBe(5n);
    });
  });
});

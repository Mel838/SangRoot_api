import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import { AgentsService } from "./agents.service";

// Mock the @voltagent/core and @voltagent/postgres classes
jest.mock("@voltagent/core", () => {
	return {
		Agent: jest.fn().mockImplementation(() => {
			return {}; // Return an empty object or whatever minimal mock is needed
		}),
		Memory: jest.fn().mockImplementation(() => {
			return {};
		}),
		createTool: jest.fn(),
		ModelProviderRegistry: {
			getInstance: jest.fn().mockReturnValue({
				stopAutoRefresh: jest.fn(),
			}),
		},
	};
});

jest.mock("@voltagent/postgres", () => {
	return {
		PostgreSQLMemoryAdapter: jest.fn().mockImplementation(() => {
			return {};
		}),
	};
});

import { Agent, Memory } from "@voltagent/core";
import { PostgreSQLMemoryAdapter } from "@voltagent/postgres";

describe("AgentsService", () => {
	let service: AgentsService;
	let configService: ConfigService;

	beforeEach(async () => {
		// Clear all mocks before each test
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AgentsService,
				{
					provide: ConfigService,
					useValue: {
						get: jest.fn().mockReturnValue("postgresql://mock-db-url"),
					},
				},
			],
		}).compile();

		service = module.get<AgentsService>(AgentsService);
		configService = module.get<ConfigService>(ConfigService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});

	describe("onModuleInit", () => {
		it("should initialize agents with correct configuration", () => {
			service.onModuleInit();

			// Verify ConfigService usage
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(configService.get).toHaveBeenCalledWith(
				"DATABASE_URL",
				"postgresql://localhost:5432/sangroot_worker",
			);

			// Verify PostgreSQLMemoryAdapter initialization
			expect(PostgreSQLMemoryAdapter).toHaveBeenCalledWith({
				connection: "postgresql://mock-db-url",
				tablePrefix: "sangroot_memory",
			});

			// Verify Memory initialization
			expect(Memory).toHaveBeenCalledTimes(1);

			// Verify Agent initialization
			// We expect 5 agents: donorOutreach, bloodBank, eligibility, result, sangrootCoordinator
			expect(Agent).toHaveBeenCalledTimes(5);

			// We can also inspect the calls to Agent to verify specific agents were created
			// detailed checks on arguments would go here if needed
		});
	});

	describe("getCoordinatorAgent", () => {
		it("should return the coordinator agent instance", () => {
			service.onModuleInit();
			const agent = service.getCoordinatorAgent();
			expect(agent).toBeDefined();
		});
	});
});

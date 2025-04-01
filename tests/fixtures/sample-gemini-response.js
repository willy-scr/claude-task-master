/**
 * Sample Gemini API response for testing
 */

export const sampleGeminiResponse = {
  tasks: [
    {
      id: 1,
      title: "Initialize Project Structure",
      description: "Set up the basic project structure and configuration files",
      status: "pending",
      dependencies: [],
      priority: "high",
      details: "Create package.json, install dependencies, setup TypeScript config",
      testStrategy: "Verify all config files exist and are valid"
    },
    {
      id: 2,
      title: "Implement Core Data Models",
      description: "Create the fundamental data models for the application",
      status: "pending",
      dependencies: [1],
      priority: "high",
      details: "Define interfaces and types for core entities",
      testStrategy: "Write unit tests for all models"
    },
    {
      id: 3,
      title: "Setup Database Integration",
      description: "Configure and implement database connectivity",
      status: "pending",
      dependencies: [2],
      priority: "medium",
      details: "Install and configure database ORM, create connection manager",
      testStrategy: "Test database connections and basic CRUD operations"
    }
  ],
  metadata: {
    projectName: "Test Project",
    totalTasks: 3,
    sourceFile: "test-prd.txt",
    generatedAt: new Date().toISOString()
  }
}; 
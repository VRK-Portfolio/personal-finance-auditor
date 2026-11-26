export const incomeTypeDefs = `
    type Income {
        _id: ID!
        amount: Float!
        source: String!
        date: String!
    }

    type IncomeResult {
        success: Boolean!
        message: String
        errors: [FieldError!]
    }

    type IncomeListResult {
        response: [Income!]
        success: Boolean!
        message: String
        errors: String
    }
    type IncomeByIdResult {
        response: Income
        success: Boolean!
        message: String
        errors: [FieldError!]
    }
    type Query {
        income(startDate: String, endDate: String): IncomeListResult!
        incomeById(_id: ID!): IncomeByIdResult!
    }

    input IncomeInput {
        amount: Float!
        source: String!
        date: String
    }
    type Mutation {
        addIncome(input: IncomeInput!): IncomeResult!
        deleteIncome(_id: ID!): IncomeResult!
        updateIncome(_id: ID!, input: IncomeInput!): IncomeResult!
    }
`;
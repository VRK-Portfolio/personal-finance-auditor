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
        errorMessage: String
    }

    type IncomeListResult {
        response: [Income!]
        success: Boolean!
        message: String
        errorMessage: String
    }
    type Query {
        income: IncomeListResult!
    }

    type Mutation {
        addIncome(amount: Float!, source: String!, date: String): IncomeResult!
        deleteIncome(_id: ID!): IncomeResult!
        updateIncome(_id: ID!, amount: Float, source: String, date: String): IncomeResult!
    }
`
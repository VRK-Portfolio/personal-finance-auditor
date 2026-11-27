import { incomeTypeDefs } from "./income/typeDefs";
import { authTypeDefs } from "./auth/typeDefs";
import { expensesTypeDefs } from "./expenses/typeDefs";
import { categoryTypeDefs } from "./category/typeDefs";
import { savingsTypeDefs } from "./savings/typedefs";
import { savingCategoryTypeDefs } from "./savingCategory/typeDefs";

const commonTypeDefs = `
    type FieldError {
        field: String!
        message: String!
    }

    type ApiResponse {
        success: Boolean!
        message: String
        errors: [FieldError!]
    }
`;


export const typeDefs = [
    commonTypeDefs,
    incomeTypeDefs,
    authTypeDefs,
    expensesTypeDefs,
    categoryTypeDefs,
    savingsTypeDefs,
    savingCategoryTypeDefs
];
import { incomeResolvers } from "./income/resolvers";
import { authResolvers } from "./auth/resolvers";

export const resolvers = {
    ...incomeResolvers,
    ...authResolvers
}
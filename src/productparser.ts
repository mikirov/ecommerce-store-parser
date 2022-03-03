import {Product} from "./product";

export interface IProductParser {
    parse(baseUrl: URL): Promise<Set<Product>>;
}

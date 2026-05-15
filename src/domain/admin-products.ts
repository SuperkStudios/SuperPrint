type AdminProductListItem = {
  status: string;
  productFileStorageKey?: string | null;
};

export function buildAdminProductCatalogStats(products: AdminProductListItem[]) {
  return {
    total: products.length,
    active: products.filter((product) => product.status === "ACTIVE").length,
    archived: products.filter((product) => product.status === "ARCHIVED").length,
    withPrintFiles: products.filter((product) => Boolean(product.productFileStorageKey)).length
  };
}

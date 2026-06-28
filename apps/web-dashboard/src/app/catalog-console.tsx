"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  DashboardEmptyState,
  DashboardFeedback,
  DashboardLoadingState
} from "../components/dashboard-state";
import { env } from "../lib/env";

type ApiState = {
  kind: "idle" | "success" | "error";
  message?: string;
};

type CatalogCategory = {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  sortOrder: number;
};

type CatalogProduct = {
  id: string;
  storeId: string;
  categoryId: string | null;
  name: string;
  slug: string;
  description: string | null;
  sku: string | null;
  priceCents: number;
  compareAtCents: number | null;
  currencyCode: string;
  stockQuantity: number;
  status: string;
  isFeatured: boolean;
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  images: Array<{
    id: string;
    altText: string | null;
    imageUrl: string;
    isPrimary: boolean;
    sortOrder: number;
  }>;
};

type CatalogConsoleProps = {
  token: string;
  storeId: string;
  storeLabel: string;
};

type CategoryFormState = {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
};

type ProductFormState = {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  sku: string;
  categoryId: string;
  priceCents: string;
  compareAtCents: string;
  stockQuantity: string;
  status: string;
  isFeatured: boolean;
};

const EMPTY_CATEGORY_FORM: CategoryFormState = {
  id: null,
  name: "",
  slug: "",
  description: "",
  sortOrder: "0"
};

const EMPTY_PRODUCT_FORM: ProductFormState = {
  id: null,
  name: "",
  slug: "",
  description: "",
  sku: "",
  categoryId: "",
  priceCents: "",
  compareAtCents: "",
  stockQuantity: "0",
  status: "DRAFT",
  isFeatured: false
};

function normalizeMessage(payload: unknown, fallback: string) {
  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const value = (payload as { message?: unknown }).message;

    if (typeof value === "string") {
      return value;
    }
  }

  return fallback;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatMoney(valueInCents: number, currencyCode: string, locale = "pt-BR") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode
  }).format(valueInCents / 100);
}

function getProductActionLabel(status: string) {
  switch (status) {
    case "ACTIVE":
      return "Ativo";
    case "INACTIVE":
      return "Inativo";
    case "OUT_OF_STOCK":
      return "Sem estoque";
    case "ARCHIVED":
      return "Arquivado";
    default:
      return "Rascunho";
  }
}

export function CatalogConsole({ token, storeId, storeLabel }: CatalogConsoleProps) {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(EMPTY_CATEGORY_FORM);
  const [productForm, setProductForm] = useState<ProductFormState>(EMPTY_PRODUCT_FORM);
  const [categoryState, setCategoryState] = useState<ApiState>({ kind: "idle" });
  const [productState, setProductState] = useState<ApiState>({ kind: "idle" });
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (statusFilter && product.status !== statusFilter) {
        return false;
      }

      if (stockFilter === "in-stock" && product.stockQuantity <= 0) {
        return false;
      }

      if (stockFilter === "out-of-stock" && product.stockQuantity > 0) {
        return false;
      }

      if (categoryFilter && product.categoryId !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [categoryFilter, products, statusFilter, stockFilter]);

  async function loadCategories() {
    if (!storeId) {
      return;
    }

    setIsLoadingCategories(true);

    try {
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/catalog/${storeId}/categories`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const payload = (await response.json()) as {
        categories?: CatalogCategory[];
        message?: string;
      };

      if (!response.ok || !payload.categories) {
        setCategories([]);
        setCategoryState({
          kind: "error",
          message: normalizeMessage(payload, "Nao foi possivel carregar as categorias.")
        });
        return;
      }

      setCategories(payload.categories);
    } catch {
      setCategories([]);
      setCategoryState({
        kind: "error",
        message: "Falha de rede ao carregar as categorias."
      });
    } finally {
      setIsLoadingCategories(false);
    }
  }

  async function loadProducts() {
    if (!storeId) {
      return;
    }

    setIsLoadingProducts(true);

    try {
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/catalog/${storeId}/products`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const payload = (await response.json()) as {
        products?: CatalogProduct[];
        message?: string;
      };

      if (!response.ok || !payload.products) {
        setProducts([]);
        setProductState({
          kind: "error",
          message: normalizeMessage(payload, "Nao foi possivel carregar os produtos.")
        });
        return;
      }

      setProducts(payload.products);
    } catch {
      setProducts([]);
      setProductState({
        kind: "error",
        message: "Falha de rede ao carregar os produtos."
      });
    } finally {
      setIsLoadingProducts(false);
    }
  }

  useEffect(() => {
    setCategoryForm(EMPTY_CATEGORY_FORM);
    setProductForm(EMPTY_PRODUCT_FORM);
    setCategoryFilter("");
    setStatusFilter("");
    setStockFilter("");
    setCategoryState({ kind: "idle" });
    setProductState({ kind: "idle" });

    if (!storeId) {
      return;
    }

    void loadCategories();
    void loadProducts();
  }, [storeId, token]);

  function resetCategoryForm() {
    setCategoryForm(EMPTY_CATEGORY_FORM);
  }

  function resetProductForm() {
    setProductForm(EMPTY_PRODUCT_FORM);
  }

  function editCategory(category: CatalogCategory) {
    setCategoryForm({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      sortOrder: String(category.sortOrder)
    });
  }

  function editProduct(product: CatalogProduct) {
    setProductForm({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description ?? "",
      sku: product.sku ?? "",
      categoryId: product.categoryId ?? "",
      priceCents: String(product.priceCents),
      compareAtCents: product.compareAtCents === null ? "" : String(product.compareAtCents),
      stockQuantity: String(product.stockQuantity),
      status: product.status,
      isFeatured: product.isFeatured
    });
  }

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoadingCategories(true);
    setCategoryState({ kind: "idle" });

    const body = {
      storeId,
      name: categoryForm.name,
      slug: categoryForm.slug,
      description: categoryForm.description || undefined,
      sortOrder: Number(categoryForm.sortOrder || "0")
    };

    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_API_URL}/catalog/${categoryForm.id ? `categories/${categoryForm.id}` : "categories"}`,
        {
          method: categoryForm.id ? "PATCH" : "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
          },
          body: JSON.stringify(body)
        }
      );
      const payload = (await response.json()) as { category?: CatalogCategory; message?: string };

      if (!response.ok || !payload.category) {
        setCategoryState({
          kind: "error",
          message: normalizeMessage(payload, "Nao foi possivel salvar a categoria.")
        });
        return;
      }

      setCategoryState({
        kind: "success",
        message: categoryForm.id
          ? "Categoria atualizada com sucesso."
          : "Categoria criada com sucesso."
      });
      resetCategoryForm();
      await loadCategories();
    } catch {
      setCategoryState({
        kind: "error",
        message: "Falha de rede ao salvar a categoria."
      });
    } finally {
      setIsLoadingCategories(false);
    }
  }

  async function deactivateCategory(categoryId: string) {
    setIsLoadingCategories(true);
    setCategoryState({ kind: "idle" });

    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_API_URL}/catalog/${storeId}/categories/${categoryId}/deactivate`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`
          }
        }
      );
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setCategoryState({
          kind: "error",
          message: normalizeMessage(payload, "Nao foi possivel desativar a categoria.")
        });
        return;
      }

      setCategoryState({
        kind: "success",
        message: "Categoria desativada."
      });
      await loadCategories();
      await loadProducts();
    } catch {
      setCategoryState({
        kind: "error",
        message: "Falha de rede ao desativar a categoria."
      });
    } finally {
      setIsLoadingCategories(false);
    }
  }

  async function handleProductSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoadingProducts(true);
    setProductState({ kind: "idle" });

    const body = {
      storeId,
      name: productForm.name,
      slug: productForm.slug,
      description: productForm.description || undefined,
      sku: productForm.sku || undefined,
      categoryId: productForm.categoryId || undefined,
      priceCents: Number(productForm.priceCents || "0"),
      compareAtCents: productForm.compareAtCents ? Number(productForm.compareAtCents) : null,
      stockQuantity: Number(productForm.stockQuantity || "0"),
      status: productForm.status,
      isFeatured: productForm.isFeatured
    };

    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_API_URL}/catalog/${productForm.id ? `products/${productForm.id}` : "products"}`,
        {
          method: productForm.id ? "PATCH" : "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
          },
          body: JSON.stringify(body)
        }
      );
      const payload = (await response.json()) as { product?: CatalogProduct; message?: string };

      if (!response.ok || !payload.product) {
        setProductState({
          kind: "error",
          message: normalizeMessage(payload, "Nao foi possivel salvar o produto.")
        });
        return;
      }

      setProductState({
        kind: "success",
        message: productForm.id
          ? "Produto atualizado com sucesso."
          : "Produto criado com sucesso."
      });
      resetProductForm();
      await loadProducts();
    } catch {
      setProductState({
        kind: "error",
        message: "Falha de rede ao salvar o produto."
      });
    } finally {
      setIsLoadingProducts(false);
    }
  }

  async function performProductAction(productId: string, action: "publish" | "deactivate" | "archive") {
    setIsLoadingProducts(true);
    setProductState({ kind: "idle" });

    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_API_URL}/catalog/${storeId}/products/${productId}/${action}`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`
          }
        }
      );
      const payload = (await response.json()) as { product?: CatalogProduct; message?: string };

      if (!response.ok || !payload.product) {
        setProductState({
          kind: "error",
          message: normalizeMessage(payload, "Nao foi possivel atualizar o status do produto.")
        });
        return;
      }

      const messages = {
        publish: "Produto publicado.",
        deactivate: "Produto desativado.",
        archive: "Produto arquivado."
      } as const;

      setProductState({
        kind: "success",
        message: messages[action]
      });
      await loadProducts();
    } catch {
      setProductState({
        kind: "error",
        message: "Falha de rede ao atualizar o status do produto."
      });
    } finally {
      setIsLoadingProducts(false);
    }
  }

  return (
    <section className="catalog-stack">
      <section className="card catalog-card">
        <div className="domain-head">
          <div>
            <div className="eyebrow">Catalog</div>
            <h2 className="section-title">Categorias de {storeLabel}</h2>
          </div>
          <button className="secondary-button" onClick={() => void loadCategories()} type="button">
            Atualizar categorias
          </button>
        </div>

        <p className="subtitle">
          Organize a navegação da loja com categorias ativas, slugs consistentes e ordem manual de exibição.
        </p>

        <form className="domain-form" onSubmit={handleCategorySubmit}>
          <div className="field-grid">
            <label className="field">
              <span>Nome</span>
              <input
                onChange={(event) =>
                  setCategoryForm((current) => {
                    const nextName = event.target.value;
                    return {
                      ...current,
                      name: nextName,
                      slug: current.id ? current.slug : slugify(nextName)
                    };
                  })
                }
                value={categoryForm.name}
              />
            </label>
            <label className="field">
              <span>Slug</span>
              <input
                onChange={(event) =>
                  setCategoryForm((current) => ({ ...current, slug: slugify(event.target.value) }))
                }
                value={categoryForm.slug}
              />
            </label>
            <label className="field">
              <span>Ordem</span>
              <input
                min="0"
                onChange={(event) =>
                  setCategoryForm((current) => ({ ...current, sortOrder: event.target.value }))
                }
                type="number"
                value={categoryForm.sortOrder}
              />
            </label>
          </div>
          <label className="field">
            <span>Descrição</span>
            <textarea
              onChange={(event) =>
                setCategoryForm((current) => ({ ...current, description: event.target.value }))
              }
              rows={3}
              value={categoryForm.description}
            />
          </label>
          <div className="button-row">
            <button className="primary-button" disabled={isLoadingCategories} type="submit">
              {isLoadingCategories
                ? "Salvando..."
                : categoryForm.id
                  ? "Atualizar categoria"
                  : "Criar categoria"}
            </button>
            {categoryForm.id ? (
              <button className="secondary-button" onClick={resetCategoryForm} type="button">
                Nova categoria
              </button>
            ) : null}
          </div>
        </form>

        <DashboardFeedback state={categoryState} />

        <div className="catalog-list">
          {categories.map((category) => (
            <article className="catalog-item-card" key={category.id}>
              <div className="catalog-item-head">
                <div>
                  <div className="eyebrow">Categoria</div>
                  <h3>{category.name}</h3>
                </div>
                <div className="catalog-status-badge">{category.status}</div>
              </div>
              <div className="catalog-meta-grid">
                <div>
                  <span>Slug</span>
                  <strong>{category.slug}</strong>
                </div>
                <div>
                  <span>Ordem</span>
                  <strong>{category.sortOrder}</strong>
                </div>
              </div>
              <p className="catalog-description">
                {category.description ?? "Sem descrição ainda."}
              </p>
              <div className="button-row">
                <button className="secondary-button" onClick={() => editCategory(category)} type="button">
                  Editar
                </button>
                {category.status !== "INACTIVE" ? (
                  <button
                    className="secondary-button"
                    onClick={() => void deactivateCategory(category.id)}
                    type="button"
                  >
                    Desativar
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          {isLoadingCategories && categories.length === 0 ? (
            <DashboardLoadingState label="Carregando categorias da loja" />
          ) : null}
          {!isLoadingCategories && categories.length === 0 ? (
            <DashboardEmptyState
              description="Crie categorias para organizar a navegação da vitrine e a operação do catálogo."
              title="Nenhuma categoria cadastrada"
            />
          ) : null}
        </div>
      </section>

      <section className="card catalog-card">
        <div className="domain-head">
          <div>
            <div className="eyebrow">Catalog</div>
            <h2 className="section-title">Produtos da loja</h2>
          </div>
          <button className="secondary-button" onClick={() => void loadProducts()} type="button">
            Atualizar produtos
          </button>
        </div>

        <p className="subtitle">
          Cadastre, revise e publique o catálogo com filtros rápidos por status, estoque e categoria.
        </p>

        <form className="domain-form" onSubmit={handleProductSubmit}>
          <div className="field-grid">
            <label className="field">
              <span>Nome</span>
              <input
                onChange={(event) =>
                  setProductForm((current) => {
                    const nextName = event.target.value;
                    return {
                      ...current,
                      name: nextName,
                      slug: current.id ? current.slug : slugify(nextName)
                    };
                  })
                }
                value={productForm.name}
              />
            </label>
            <label className="field">
              <span>Slug</span>
              <input
                onChange={(event) =>
                  setProductForm((current) => ({ ...current, slug: slugify(event.target.value) }))
                }
                value={productForm.slug}
              />
            </label>
            <label className="field">
              <span>Categoria</span>
              <select
                className="field-select"
                onChange={(event) =>
                  setProductForm((current) => ({ ...current, categoryId: event.target.value }))
                }
                value={productForm.categoryId}
              >
                <option value="">Sem categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>SKU</span>
              <input
                onChange={(event) =>
                  setProductForm((current) => ({ ...current, sku: event.target.value }))
                }
                value={productForm.sku}
              />
            </label>
            <label className="field">
              <span>Preço (centavos)</span>
              <input
                min="0"
                onChange={(event) =>
                  setProductForm((current) => ({ ...current, priceCents: event.target.value }))
                }
                type="number"
                value={productForm.priceCents}
              />
            </label>
            <label className="field">
              <span>Preço comparativo</span>
              <input
                min="0"
                onChange={(event) =>
                  setProductForm((current) => ({ ...current, compareAtCents: event.target.value }))
                }
                type="number"
                value={productForm.compareAtCents}
              />
            </label>
            <label className="field">
              <span>Estoque</span>
              <input
                min="0"
                onChange={(event) =>
                  setProductForm((current) => ({ ...current, stockQuantity: event.target.value }))
                }
                type="number"
                value={productForm.stockQuantity}
              />
            </label>
            <label className="field">
              <span>Status inicial</span>
              <select
                className="field-select"
                onChange={(event) =>
                  setProductForm((current) => ({ ...current, status: event.target.value }))
                }
                value={productForm.status}
              >
                <option value="DRAFT">DRAFT</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>Descrição</span>
            <textarea
              onChange={(event) =>
                setProductForm((current) => ({ ...current, description: event.target.value }))
              }
              rows={4}
              value={productForm.description}
            />
          </label>
          <label className="feature-toggle">
            <input
              checked={productForm.isFeatured}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, isFeatured: event.target.checked }))
              }
              type="checkbox"
            />
            <span>Destacar este produto na vitrine</span>
          </label>
          <div className="button-row">
            <button className="primary-button" disabled={isLoadingProducts} type="submit">
              {isLoadingProducts
                ? "Salvando..."
                : productForm.id
                  ? "Atualizar produto"
                  : "Criar produto"}
            </button>
            {productForm.id ? (
              <button className="secondary-button" onClick={resetProductForm} type="button">
                Novo produto
              </button>
            ) : null}
          </div>
        </form>

        <DashboardFeedback state={productState} />

        <div className="catalog-filters">
          <label className="field">
            <span>Status</span>
            <select
              className="field-select"
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="">Todos</option>
              <option value="DRAFT">DRAFT</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="OUT_OF_STOCK">OUT_OF_STOCK</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </label>
          <label className="field">
            <span>Estoque</span>
            <select
              className="field-select"
              onChange={(event) => setStockFilter(event.target.value)}
              value={stockFilter}
            >
              <option value="">Todos</option>
              <option value="in-stock">Com estoque</option>
              <option value="out-of-stock">Sem estoque</option>
            </select>
          </label>
          <label className="field">
            <span>Categoria</span>
            <select
              className="field-select"
              onChange={(event) => setCategoryFilter(event.target.value)}
              value={categoryFilter}
            >
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="catalog-list">
          {filteredProducts.map((product) => (
            <article className="catalog-item-card" key={product.id}>
              <div className="catalog-item-head">
                <div>
                  <div className="eyebrow">Produto</div>
                  <h3>{product.name}</h3>
                </div>
                <div className="catalog-status-badge">{getProductActionLabel(product.status)}</div>
              </div>

              <div className="catalog-meta-grid">
                <div>
                  <span>Preço</span>
                  <strong>{formatMoney(product.priceCents, product.currencyCode)}</strong>
                </div>
                <div>
                  <span>Estoque</span>
                  <strong>{product.stockQuantity}</strong>
                </div>
                <div>
                  <span>Categoria</span>
                  <strong>{product.category?.name ?? "Sem categoria"}</strong>
                </div>
                <div>
                  <span>Imagens</span>
                  <strong>{product.images.length}</strong>
                </div>
              </div>

              <p className="catalog-description">
                {product.description ?? "Sem descrição ainda."}
              </p>

              <div className="catalog-inline-note">
                <strong>Slug:</strong> {product.slug}
                {product.sku ? ` • SKU: ${product.sku}` : ""}
                {product.isFeatured ? " • Destaque na vitrine" : ""}
              </div>

              <div className="button-row">
                <button className="secondary-button" onClick={() => editProduct(product)} type="button">
                  Editar
                </button>
                {product.status !== "ACTIVE" ? (
                  <button
                    className="secondary-button"
                    onClick={() => void performProductAction(product.id, "publish")}
                    type="button"
                  >
                    Publicar
                  </button>
                ) : null}
                {product.status !== "INACTIVE" && product.status !== "ARCHIVED" ? (
                  <button
                    className="secondary-button"
                    onClick={() => void performProductAction(product.id, "deactivate")}
                    type="button"
                  >
                    Desativar
                  </button>
                ) : null}
                {product.status !== "ARCHIVED" ? (
                  <button
                    className="secondary-button"
                    onClick={() => void performProductAction(product.id, "archive")}
                    type="button"
                  >
                    Arquivar
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          {isLoadingProducts && products.length === 0 ? (
            <DashboardLoadingState label="Carregando produtos da loja" />
          ) : null}
          {!isLoadingProducts && filteredProducts.length === 0 ? (
            <DashboardEmptyState
              description="Ajuste os filtros ou cadastre o primeiro produto para começar a operar o catálogo."
              title="Nenhum produto encontrado"
            />
          ) : null}
        </div>
      </section>
    </section>
  );
}

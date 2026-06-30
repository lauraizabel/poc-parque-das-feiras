"use client";

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  DashboardEmptyState,
  DashboardFeedback,
  DashboardLoadingState
} from "../components/dashboard-state";
import { authHeaders, dashboardApiJson, normalizeApiMessage } from "../lib/dashboard-api";
import { formatProductStatusLabel } from "../lib/enum-labels";

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
  price: string;
  compareAt: string;
  stockQuantity: string;
  status: string;
  isFeatured: boolean;
};

type EditorMode = "product" | "category" | null;

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
  price: "",
  compareAt: "",
  stockQuantity: "0",
  status: "DRAFT",
  isFeatured: false
};

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

function centsToInput(valueInCents: number | null) {
  if (valueInCents === null) {
    return "";
  }

  return (valueInCents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function inputToCents(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100);
}

function getStatusLabel(status: string) {
  return formatProductStatusLabel(status);
}

function getProductTone(product: CatalogProduct) {
  if (product.status === "OUT_OF_STOCK" || product.stockQuantity <= 0) {
    return "accent";
  }

  if (product.stockQuantity <= 3) {
    return "warn";
  }

  return "signal";
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
  const [query, setQuery] = useState("");
  const [editorMode, setEditorMode] = useState<EditorMode>(null);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

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

      if (!normalizedQuery) {
        return true;
      }

      return [product.name, product.sku, product.slug]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedQuery));
    });
  }, [categoryFilter, products, query, statusFilter, stockFilter]);

  async function loadCategories() {
    if (!storeId) {
      return;
    }

    setIsLoadingCategories(true);

    try {
      const { payload, response } = await dashboardApiJson<{
        categories?: CatalogCategory[];
        message?: string;
      }>(`/catalog/${storeId}/categories`, {
        headers: authHeaders(token)
      });

      if (!response.ok || !payload.categories) {
        setCategories([]);
        setCategoryState({
          kind: "error",
          message: normalizeApiMessage(payload, "Nao foi possivel carregar as categorias.")
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
      const { payload, response } = await dashboardApiJson<{
        products?: CatalogProduct[];
        message?: string;
      }>(`/catalog/${storeId}/products`, {
        headers: authHeaders(token)
      });

      if (!response.ok || !payload.products) {
        setProducts([]);
        setProductState({
          kind: "error",
          message: normalizeApiMessage(payload, "Nao foi possivel carregar os produtos.")
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
    setQuery("");
    setEditorMode(null);
    setCategoryState({ kind: "idle" });
    setProductState({ kind: "idle" });

    if (!storeId) {
      return;
    }

    void loadCategories();
    void loadProducts();
  }, [storeId, token]);

  function openNewProduct() {
    setProductForm(EMPTY_PRODUCT_FORM);
    setEditorMode("product");
  }

  function openNewCategory() {
    setCategoryForm(EMPTY_CATEGORY_FORM);
    setEditorMode("category");
  }

  function editCategory(category: CatalogCategory) {
    setCategoryForm({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      sortOrder: String(category.sortOrder)
    });
    setEditorMode("category");
  }

  function editProduct(product: CatalogProduct) {
    setProductForm({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description ?? "",
      sku: product.sku ?? "",
      categoryId: product.categoryId ?? "",
      price: centsToInput(product.priceCents),
      compareAt: centsToInput(product.compareAtCents),
      stockQuantity: String(product.stockQuantity),
      status: product.status,
      isFeatured: product.isFeatured
    });
    setEditorMode("product");
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
      const { payload, response } = await dashboardApiJson<{
        category?: CatalogCategory;
        message?: string;
      }>(`/catalog/${categoryForm.id ? `categories/${categoryForm.id}` : "categories"}`, {
        method: categoryForm.id ? "PATCH" : "POST",
        headers: authHeaders(token, {
          "content-type": "application/json"
        }),
        body: JSON.stringify(body)
      });

      if (!response.ok || !payload.category) {
        setCategoryState({
          kind: "error",
          message: normalizeApiMessage(payload, "Nao foi possivel salvar a categoria.")
        });
        return;
      }

      setCategoryState({
        kind: "success",
        message: categoryForm.id ? "Categoria atualizada com sucesso." : "Categoria criada com sucesso."
      });
      setCategoryForm(EMPTY_CATEGORY_FORM);
      setEditorMode(null);
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
      const { payload, response } = await dashboardApiJson<{ message?: string }>(
        `/catalog/${storeId}/categories/${categoryId}/deactivate`,
        {
          method: "POST",
          headers: authHeaders(token)
        }
      );

      if (!response.ok) {
        setCategoryState({
          kind: "error",
          message: normalizeApiMessage(payload, "Nao foi possivel desativar a categoria.")
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
      priceCents: inputToCents(productForm.price),
      compareAtCents: productForm.compareAt ? inputToCents(productForm.compareAt) : null,
      stockQuantity: Number(productForm.stockQuantity || "0"),
      status: productForm.status,
      isFeatured: productForm.isFeatured
    };

    try {
      const { payload, response } = await dashboardApiJson<{
        product?: CatalogProduct;
        message?: string;
      }>(`/catalog/${productForm.id ? `products/${productForm.id}` : "products"}`, {
        method: productForm.id ? "PATCH" : "POST",
        headers: authHeaders(token, {
          "content-type": "application/json"
        }),
        body: JSON.stringify(body)
      });

      if (!response.ok || !payload.product) {
        setProductState({
          kind: "error",
          message: normalizeApiMessage(payload, "Nao foi possivel salvar o produto.")
        });
        return;
      }

      setProductState({
        kind: "success",
        message: productForm.id ? "Produto atualizado com sucesso." : "Produto criado com sucesso."
      });
      setProductForm(EMPTY_PRODUCT_FORM);
      setEditorMode(null);
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

  async function performProductAction(
    productId: string,
    action: "publish" | "deactivate" | "archive"
  ) {
    setIsLoadingProducts(true);
    setProductState({ kind: "idle" });

    try {
      const { payload, response } = await dashboardApiJson<{
        product?: CatalogProduct;
        message?: string;
      }>(`/catalog/${storeId}/products/${productId}/${action}`, {
        method: "POST",
        headers: authHeaders(token)
      });

      if (!response.ok || !payload.product) {
        setProductState({
          kind: "error",
          message: normalizeApiMessage(payload, "Nao foi possivel atualizar o status do produto.")
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
    <section className="catalog-console animate-entrance">
      <header className="catalog-console-header">
        <div>
          <div className="eyebrow">Console / Catalogo</div>
          <h2>Produtos de {storeLabel}</h2>
          <p>
            {products.length} produtos / {categories.length} categorias /{" "}
            {products.filter((product) => product.stockQuantity <= 3).length} com estoque critico
          </p>
        </div>
        <div className="catalog-console-actions">
          <button className="secondary-button" onClick={() => void loadProducts()} type="button">
            Atualizar
          </button>
          <button className="secondary-button" onClick={openNewCategory} type="button">
            Nova categoria
          </button>
          <button className="primary-button" onClick={openNewProduct} type="button">
            Novo produto
          </button>
        </div>
      </header>

      <DashboardFeedback state={productState} />
      <DashboardFeedback state={categoryState} />

      <section className="catalog-category-strip">
        <div className="catalog-category-card is-summary">
          <span>Categorias ativas</span>
          <strong>{categories.filter((category) => category.status !== "INACTIVE").length}</strong>
        </div>
        {categories.slice(0, 5).map((category) => (
          <article className="catalog-category-card" key={category.id}>
            <div>
              <strong>{category.name}</strong>
              <span>{category.slug}</span>
            </div>
            <div className="catalog-mini-actions">
              <button onClick={() => editCategory(category)} type="button">
                Editar
              </button>
              {category.status !== "INACTIVE" ? (
                <button onClick={() => void deactivateCategory(category.id)} type="button">
                  Desativar
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      <section className={editorMode ? "catalog-workbench has-editor" : "catalog-workbench"}>
        <div className="catalog-table-card">
          <div className="catalog-toolbar">
            <label className="catalog-search">
              <span>Buscar</span>
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nome, SKU ou slug"
                value={query}
              />
            </label>
            <label>
              <span>Status</span>
              <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                <option value="">Todos</option>
                <option value="DRAFT">Rascunho</option>
                <option value="ACTIVE">Publicado</option>
                <option value="INACTIVE">Inativo</option>
                <option value="OUT_OF_STOCK">Sem estoque</option>
                <option value="ARCHIVED">Arquivado</option>
              </select>
            </label>
            <label>
              <span>Estoque</span>
              <select onChange={(event) => setStockFilter(event.target.value)} value={stockFilter}>
                <option value="">Todos</option>
                <option value="in-stock">Com estoque</option>
                <option value="out-of-stock">Sem estoque</option>
              </select>
            </label>
            <label>
              <span>Categoria</span>
              <select
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

          {isLoadingProducts && products.length === 0 ? (
            <DashboardLoadingState label="Carregando produtos da loja" />
          ) : null}

          {!isLoadingProducts && filteredProducts.length === 0 ? (
            <DashboardEmptyState
              description="Ajuste os filtros ou cadastre o primeiro produto para comecar a operar o catalogo."
              title="Nenhum produto encontrado"
            />
          ) : null}

          {filteredProducts.length > 0 ? (
            <div className="catalog-product-table">
              <div className="catalog-product-row is-heading">
                <span>Produto</span>
                <span>Categoria</span>
                <span>Preco</span>
                <span>Estoque</span>
                <span>Status</span>
                <span>Acoes</span>
              </div>
              {filteredProducts.map((product) => (
                <ProductRow
                  key={product.id}
                  onAction={performProductAction}
                  onEdit={editProduct}
                  product={product}
                />
              ))}
            </div>
          ) : null}
        </div>

        {editorMode ? (
          <aside className="catalog-editor-panel">
            <div className="catalog-editor-head">
              <div>
                <div className="eyebrow">
                  {editorMode === "product" ? "Produto" : "Categoria"}
                </div>
                <h3>
                  {editorMode === "product"
                    ? productForm.id
                      ? "Editar produto"
                      : "Novo produto"
                    : categoryForm.id
                      ? "Editar categoria"
                      : "Nova categoria"}
                </h3>
              </div>
              <button onClick={() => setEditorMode(null)} type="button">
                Fechar
              </button>
            </div>

            {editorMode === "product" ? (
              <ProductForm
                categories={categories}
                form={productForm}
                isLoading={isLoadingProducts}
                onChange={setProductForm}
                onSubmit={handleProductSubmit}
              />
            ) : (
              <CategoryForm
                form={categoryForm}
                isLoading={isLoadingCategories}
                onChange={setCategoryForm}
                onSubmit={handleCategorySubmit}
              />
            )}
          </aside>
        ) : null}
      </section>
    </section>
  );
}

function ProductRow({
  onAction,
  onEdit,
  product
}: {
  onAction: (productId: string, action: "publish" | "deactivate" | "archive") => Promise<void>;
  onEdit: (product: CatalogProduct) => void;
  product: CatalogProduct;
}) {
  const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0];
  const tone = getProductTone(product);

  return (
    <article className="catalog-product-row">
      <div className="catalog-product-cell-main">
        <div className="catalog-product-thumb">
          {primaryImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={primaryImage.altText ?? product.name} src={primaryImage.imageUrl} />
          ) : (
            <span>IMG</span>
          )}
        </div>
        <div>
          <strong>{product.name}</strong>
          <span>{product.sku ?? product.slug}</span>
        </div>
      </div>
      <span>{product.category?.name ?? "Sem categoria"}</span>
      <span>{formatMoney(product.priceCents, product.currencyCode)}</span>
      <span className={`catalog-stock is-${tone}`}>{product.stockQuantity}</span>
      <span className={`catalog-status is-${tone}`}>{getStatusLabel(product.status)}</span>
      <div className="catalog-row-actions">
        <button onClick={() => onEdit(product)} type="button">
          Editar
        </button>
        {product.status !== "ACTIVE" ? (
          <button onClick={() => void onAction(product.id, "publish")} type="button">
            Publicar
          </button>
        ) : null}
        {product.status !== "INACTIVE" && product.status !== "ARCHIVED" ? (
          <button onClick={() => void onAction(product.id, "deactivate")} type="button">
            Inativar
          </button>
        ) : null}
        {product.status !== "ARCHIVED" ? (
          <button onClick={() => void onAction(product.id, "archive")} type="button">
            Arquivar
          </button>
        ) : null}
      </div>
    </article>
  );
}

function ProductForm({
  categories,
  form,
  isLoading,
  onChange,
  onSubmit
}: {
  categories: CatalogCategory[];
  form: ProductFormState;
  isLoading: boolean;
  onChange: (form: ProductFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="catalog-editor-form" onSubmit={onSubmit}>
      <EditorField label="Nome">
        <input
          onChange={(event) => {
            const name = event.target.value;
            onChange({
              ...form,
              name,
              slug: form.id ? form.slug : slugify(name)
            });
          }}
          required
          value={form.name}
        />
      </EditorField>
      <EditorField label="Slug">
        <input
          onChange={(event) => onChange({ ...form, slug: slugify(event.target.value) })}
          required
          value={form.slug}
        />
      </EditorField>
      <EditorField label="Categoria">
        <select
          onChange={(event) => onChange({ ...form, categoryId: event.target.value })}
          value={form.categoryId}
        >
          <option value="">Sem categoria</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </EditorField>
      <EditorField label="SKU">
        <input onChange={(event) => onChange({ ...form, sku: event.target.value })} value={form.sku} />
      </EditorField>
      <div className="catalog-editor-grid">
        <EditorField label="Preco">
          <input
            inputMode="decimal"
            onChange={(event) => onChange({ ...form, price: event.target.value })}
            placeholder="0,00"
            required
            value={form.price}
          />
        </EditorField>
        <EditorField label="Comparativo">
          <input
            inputMode="decimal"
            onChange={(event) => onChange({ ...form, compareAt: event.target.value })}
            placeholder="0,00"
            value={form.compareAt}
          />
        </EditorField>
      </div>
      <div className="catalog-editor-grid">
        <EditorField label="Estoque">
          <input
            min="0"
            onChange={(event) => onChange({ ...form, stockQuantity: event.target.value })}
            type="number"
            value={form.stockQuantity}
          />
        </EditorField>
        <EditorField label="Status">
          <select onChange={(event) => onChange({ ...form, status: event.target.value })} value={form.status}>
            <option value="DRAFT">Rascunho</option>
            <option value="ACTIVE">Publicado</option>
            <option value="INACTIVE">Inativo</option>
          </select>
        </EditorField>
      </div>
      <EditorField label="Descricao">
        <textarea
          onChange={(event) => onChange({ ...form, description: event.target.value })}
          rows={4}
          value={form.description}
        />
      </EditorField>
      <label className="catalog-checkbox">
        <input
          checked={form.isFeatured}
          onChange={(event) => onChange({ ...form, isFeatured: event.target.checked })}
          type="checkbox"
        />
        <span>Destacar este produto na vitrine</span>
      </label>
      <button className="primary-button" disabled={isLoading} type="submit">
        {isLoading ? "Salvando..." : form.id ? "Atualizar produto" : "Criar produto"}
      </button>
    </form>
  );
}

function CategoryForm({
  form,
  isLoading,
  onChange,
  onSubmit
}: {
  form: CategoryFormState;
  isLoading: boolean;
  onChange: (form: CategoryFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="catalog-editor-form" onSubmit={onSubmit}>
      <EditorField label="Nome">
        <input
          onChange={(event) => {
            const name = event.target.value;
            onChange({
              ...form,
              name,
              slug: form.id ? form.slug : slugify(name)
            });
          }}
          required
          value={form.name}
        />
      </EditorField>
      <EditorField label="Slug">
        <input
          onChange={(event) => onChange({ ...form, slug: slugify(event.target.value) })}
          required
          value={form.slug}
        />
      </EditorField>
      <EditorField label="Ordem">
        <input
          min="0"
          onChange={(event) => onChange({ ...form, sortOrder: event.target.value })}
          type="number"
          value={form.sortOrder}
        />
      </EditorField>
      <EditorField label="Descricao">
        <textarea
          onChange={(event) => onChange({ ...form, description: event.target.value })}
          rows={4}
          value={form.description}
        />
      </EditorField>
      <button className="primary-button" disabled={isLoading} type="submit">
        {isLoading ? "Salvando..." : form.id ? "Atualizar categoria" : "Criar categoria"}
      </button>
    </form>
  );
}

function EditorField({
  children,
  label
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="catalog-editor-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

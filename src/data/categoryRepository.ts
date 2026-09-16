import type { Category, NewCategory } from '../types'
import { categories as seedCategories } from './seed'

export interface CategoryRepository {
  list(): Promise<Category[]>
  create(category: NewCategory): Promise<Category>
  update(id: string, category: NewCategory): Promise<Category>
  remove(id: string): Promise<void>
}

export class LocalCategoryRepository implements CategoryRepository {
  private readonly storageKey = 'haru.categories.v1'
  private fallback = seedCategories

  async list() {
    const saved = localStorage.getItem(this.storageKey)
    return saved ? (JSON.parse(saved) as Category[]) : this.fallback
  }

  async create(input: NewCategory) {
    const category: Category = { ...input, id: crypto.randomUUID() }
    this.persist([...(await this.list()), category])
    return category
  }

  async update(id: string, input: NewCategory) {
    let changed: Category = { id, ...input }
    const next = (await this.list()).map((category) => {
      if (category.id !== id) return category
      changed = { ...category, ...input }
      return changed
    })
    this.persist(next)
    return changed
  }

  async remove(id: string) {
    this.persist((await this.list()).filter((category) => category.id !== id))
  }

  private persist(categories: Category[]) {
    this.fallback = categories
    localStorage.setItem(this.storageKey, JSON.stringify(categories))
  }
}

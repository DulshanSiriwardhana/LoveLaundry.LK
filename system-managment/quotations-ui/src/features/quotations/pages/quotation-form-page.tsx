import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Plus, Trash2, GripVertical, X } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Input } from '../../../components/ui/input'
import { useDataGrid, mergeRefs } from '../../../hooks/use-data-grid'
import { useEnterFlow } from '../../../hooks/use-enter-flow'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { useCreateQuotation, useQuotation, useUpdateQuotation } from '../hooks/useQuotations'
import type { QuotationFormValues } from '../../../types/quotation'

const COMMON_ITEMS = [
  'Bed Sheet',
  'Bed Cover (Duvet Cover)',
  'Bath Towel',
  'Face Towel',
  'Bath Mat',
  'Pillow Case',
  'Duster',
  'Table Runner',
  'Table Cloth',
  'Top Cloth',
  'Napkin',
  'Chair Cover',
  'Shirt / T-Shirt',
  'Trouser',
  'Stain Cloth',
  'Protector',
  'Hand Towel',
  'Pillow Protector',
  'Pool Towel',
  'Staff Bed Sheet',
  'Bath Robe',
  'Shower Curtain',
  'Carpet',
  'Sarong',
  'Jacket',
  'Blazer',
  'Curtain (1 Kg)',
  'Blanket',
  'Duvet Protector',
  'Mattress Protector',
  'Pool Umbrella Cover',
  'Chef Coat',
  'Spa Bed Sheet',
  'Spa Bath Towel',
  'Spa Face Towel',
]

const COMMON_CATEGORIES = [
  'Bed Linen',
  'Towels',
  'Restaurant Linen',
  'Staff Clothing',
  'Guest Clothing',
  'Spa Items',
  'Curtains & Covers',
  'Miscellaneous',
]

const specSchema = z.object({
  specification: z.string().trim().min(1, 'Required'),
  unit_price: z.string().trim().min(1, 'Required'),
})

const lineItemSchema = z.object({
  id: z.string(),
  item_name: z.string().trim().min(1, 'Required'),
  category: z.string(),
  unit_price: z.string().trim().min(1, 'Required'),
  notes: z.string(),
  specifications: z.array(specSchema),
})

const formSchema = z.object({
  client_name: z.string().trim().min(1, 'Client / hotel name is required'),
  quotation_title: z.string(),
  tag: z.enum(['shop', 'hotel']),
  line_items: z.array(lineItemSchema).min(1, 'Add at least one item'),
})

const newItem = () => ({
  id: crypto.randomUUID(),
  item_name: '',
  category: '',
  unit_price: '',
  notes: '',
  specifications: [],
})

const defaultValues: QuotationFormValues = {
  client_name: '',
  quotation_title: '',
  tag: 'shop' as 'shop' | 'hotel',
  line_items: [newItem()],
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[12px] font-medium text-[#475467] mb-1">{children}</label>
}

function FieldErr({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-[11px] text-[#DC2626]">{msg}</p> : null
}

function SpecFields({
  index,
  register,
  control,
  errors,
}: {
  index: number
  register: any
  control: any
  errors: any
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `line_items.${index}.specifications`,
  })
  const specErrors = errors?.line_items?.[index]?.specifications

  return (
    <div className="mt-2 border-t border-[#F2F4F7] pt-2">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
          Specifications / Variants
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => append({ specification: '', unit_price: '' })}
          className="text-[#2563EB] hover:bg-[#EFF4FF]"
        >
          <Plus className="h-3.5 w-3.5" /> Add Specification
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="text-[11px] text-[#98A2B3]">
          No variants for this item — it uses the unit price above. Add a colour / size with its own
          price if needed.
        </p>
      ) : (
        <div className="space-y-1.5">
          {fields.map((field, sIdx) => (
            <div key={field.id} className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  {...register(`line_items.${index}.specifications.${sIdx}.specification` as const)}
                  placeholder="e.g. White - M"
                />
                <FieldErr msg={specErrors?.[sIdx]?.specification?.message} />
              </div>
              <div className="relative w-28">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#9CA3AF]">
                  LKR
                </span>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  {...register(`line_items.${index}.specifications.${sIdx}.unit_price` as const)}
                  placeholder="150.00"
                  className="pl-9"
                />
                <FieldErr msg={specErrors?.[sIdx]?.unit_price?.message} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(sIdx)}
                aria-label="Remove specification"
                className="text-[#DC2626] hover:bg-[#FFF1F1] shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function QuotationFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const { data: existing, isLoading } = useQuotation(id)
  const createMutation = useCreateQuotation()
  const updateMutation = useUpdateQuotation()

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<QuotationFormValues>({ resolver: zodResolver(formSchema), defaultValues })

  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' })

  const grid = useDataGrid({
    columns: 4,
    rows: fields.length,
    onAppendRow: () => append(newItem()),
  })

  const flow = useEnterFlow<HTMLDivElement>()
  const tagRef = useRef<HTMLSelectElement | null>(null)
  const regTag = register('tag')

  const handleHeaderKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    flow.handleKeyDown(e)
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !e.defaultPrevented &&
      e.target === tagRef.current
    ) {
      e.preventDefault()
      grid.focusCell(0, 0)
    }
  }

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter' || e.defaultPrevented) return
    const target = e.target as HTMLElement
    if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT' && target.tagName !== 'TEXTAREA') return
    e.preventDefault()
  }

  useEffect(() => {
    if (!existing) return
    reset({
      client_name: existing.client_name,
      quotation_title: existing.quotation_title ?? '',
      tag: (existing.tag ?? 'shop') as 'shop' | 'hotel',
      line_items: (existing.line_items ?? []).map(li => ({
        id: crypto.randomUUID(),
        item_name: li.item_name,
        category: li.category ?? '',
        unit_price: String(li.unit_price),
        notes: li.notes ?? '',
        specifications: (li.specifications ?? []).map(s => ({
          specification: s.specification,
          unit_price: String(s.unit_price),
        })),
      })),
    })
  }, [existing, reset])

  const cats = useMemo(
    () =>
      Array.from(
        new Set([
          ...COMMON_CATEGORIES,
          ...(existing?.line_items?.map(l => l.category ?? '').filter(Boolean) ?? []),
        ]),
      ).sort(),
    [existing],
  )

  const onSubmit = (v: QuotationFormValues) => {
    const payload = {
      client_name: v.client_name.trim(),
      quotation_title: v.quotation_title.trim() || undefined,
      tag: v.tag,
      line_items: v.line_items.map(li => {
        const item: {
          item_name: string
          category?: string
          unit_price: number
          notes?: string
          specifications?: Array<{ specification: string; unit_price: number }>
        } = {
          item_name: li.item_name.trim(),
          category: li.category.trim() || undefined,
          unit_price: Number(li.unit_price),
          notes: li.notes.trim() || undefined,
        }
        const specs = (li.specifications ?? [])
          .filter(s => s.specification.trim() && s.unit_price.trim())
          .map(s => ({ specification: s.specification.trim(), unit_price: Number(s.unit_price) }))
        if (specs.length > 0) item.specifications = specs
        return item
      }),
    }
    if (isEdit && id) {
      updateMutation.mutate({ id, payload }, { onSuccess: () => navigate('/quotations') })
    } else {
      createMutation.mutate(payload, { onSuccess: () => navigate('/quotations') })
    }
  }

  return (
    <div className="space-y-5 pb-10 select-none">
      <div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/' },
            { label: 'Quotations', href: '/quotations' },
            { label: isEdit ? 'Edit Quotation' : 'New Quotation' },
          ]}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-dashboard-title">
              {isEdit ? 'Edit Quotation' : 'New Quotation'}
            </h1>
            <p className="text-[13px] text-[#98A2B3] mt-0.5">
              {isEdit
                ? 'Update pricing for this hotel'
                : 'Create a price list for a hotel or client'}
            </p>
          </div>
          <Button variant="secondary" onClick={() => navigate('/quotations')}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
        </div>
      </div>

      {isLoading && isEdit ? (
        <div className="rounded-xl border border-[#E4E7EC] bg-[#FAFAFA] p-10 text-[13px] text-[#98A2B3] text-center">
          Loading quotation…
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleFormKeyDown} className="space-y-4">
          <Card>
            <CardHeader className="border-b border-[#F2F4F7] pb-4">
              <div>
                <CardTitle>Client / Hotel Details</CardTitle>
                <p className="text-[12px] text-[#98A2B3] mt-0.5">
                  Name of the hotel or client this quotation is for
                </p>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div ref={flow.ref} onKeyDown={handleHeaderKeyDown} className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>Hotel / Client Name *</Label>
                  <Input
                    {...register('client_name')}
                    autoFocus={!isEdit}
                    placeholder="e.g. Nilawin Hotel, Avenra Garden Hotel"
                  />
                  <FieldErr msg={errors.client_name?.message} />
                </div>
                <div>
                  <Label>Quotation Title (optional)</Label>
                  <Input
                    {...register('quotation_title')}
                    placeholder="e.g. 2026 Price List, Annual Contract"
                  />
                </div>
                <div>
                  <Label>Quotation Type *</Label>
                  <select
                    {...regTag}
                    ref={mergeRefs(regTag.ref, tagRef)}
                    className="flex h-10 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-[14px] ring-offset-white focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="shop">Shop (Public)</option>
                    <option value="hotel">Hotel (Private)</option>
                  </select>
                  <p className="mt-1 text-[11px] text-[#667085]">Shop quotations are visible to guests</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-[#F2F4F7] pb-4">
              <div>
                <CardTitle>
                  Line Items
                  <span className="ml-2 text-[#98A2B3] font-normal text-[12px]">
                    ({fields.length} items)
                  </span>
                </CardTitle>
                <p className="text-[12px] text-[#98A2B3] mt-0.5">
                  Each row = one item with its unit price in LKR
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => append(newItem())}>
                <Plus className="h-3.5 w-3.5 text-[#DC2626]" /> Add Item
              </Button>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="hidden sm:grid sm:grid-cols-[28px_1fr_180px_120px_120px_36px] gap-2 mb-2 px-1">
                {['', 'Item Name', 'Category', 'Unit Price (LKR)', 'Notes / Variant', ''].map(
                  (h, i) => (
                    <p
                      key={i}
                      className="text-[11px] font-semibold uppercase tracking-wider text-[#98A2B3]"
                    >
                      {h}
                    </p>
                  ),
                )}
              </div>

              <div className="mb-4 p-3 rounded-lg border border-[#E4E7EC] bg-[#FAFAFA]">
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
                  Quick-add common items
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_ITEMS.map(item => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => append({ ...newItem(), item_name: item })}
                      className="rounded-md border border-[#E4E7EC] bg-white px-2 py-0.5 text-[11px] font-medium text-[#374151] hover:border-[#FECACA] hover:bg-[#FFF1F1] hover:text-[#DC2626] transition-all cursor-pointer"
                    >
                      + {item}
                    </button>
                  ))}
                </div>
              </div>

              <datalist id="item-suggestions">
                {COMMON_ITEMS.map(i => (
                  <option key={i} value={i} />
                ))}
              </datalist>
              <datalist id="cat-suggestions">
                {cats.map(c => (
                  <option key={c} value={c} />
                ))}
              </datalist>

              <div className="space-y-2" onKeyDown={grid.handleKeyDown}>
                {fields.map((field, idx) => {
                  const regItem = register(`line_items.${idx}.item_name` as const)
                  const regCat = register(`line_items.${idx}.category` as const)
                  const regPrice = register(`line_items.${idx}.unit_price` as const)
                  const regNotes = register(`line_items.${idx}.notes` as const)
                  return (
                  <div
                    key={field.id}
                    className="rounded-lg border border-[#E4E7EC] bg-white p-3 hover:border-[#D1D5DB] transition-colors"
                  >
                    <div className="grid gap-2 grid-cols-1 sm:grid-cols-[28px_1fr_180px_120px_120px_36px] items-center">
                    <div className="hidden sm:flex items-center justify-center text-[#D1D5DB]">
                      <GripVertical className="h-4 w-4" />
                    </div>

                    <div>
                      <p className="text-[11px] text-[#98A2B3] mb-1 sm:hidden">Item Name</p>
                      <Input
                        {...regItem}
                        ref={mergeRefs(regItem.ref, grid.registerCell(idx, 0))}
                        list="item-suggestions"
                        placeholder="e.g. Bed Sheet"
                      />
                      <FieldErr msg={errors.line_items?.[idx]?.item_name?.message} />
                    </div>

                    <div>
                      <p className="text-[11px] text-[#98A2B3] mb-1 sm:hidden">Category</p>
                      <Input
                        {...regCat}
                        ref={mergeRefs(regCat.ref, grid.registerCell(idx, 1))}
                        list="cat-suggestions"
                        placeholder="e.g. Bed Linen"
                      />
                    </div>

                    <div>
                      <p className="text-[11px] text-[#98A2B3] mb-1 sm:hidden">
                        Unit Price (LKR)
                      </p>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-medium text-[#9CA3AF]">
                          LKR
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          {...regPrice}
                          ref={mergeRefs(regPrice.ref, grid.registerCell(idx, 2))}
                          placeholder="125.00"
                          className="pl-11"
                        />
                      </div>
                      <FieldErr msg={errors.line_items?.[idx]?.unit_price?.message} />
                    </div>

                    <div>
                      <p className="text-[11px] text-[#98A2B3] mb-1 sm:hidden">Notes</p>
                      <Input
                        {...regNotes}
                        ref={mergeRefs(regNotes.ref, grid.registerCell(idx, 3))}
                        placeholder="e.g. (S, D)"
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(idx)}
                      disabled={fields.length === 1}
                      aria-label="Remove"
                      className="text-[#DC2626] hover:bg-[#FFF1F1] disabled:opacity-20 justify-self-end sm:justify-self-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    </div>

                    <SpecFields
                      index={idx}
                      register={register}
                      control={control}
                      errors={errors}
                    />
                  </div>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={() => append(newItem())}
                className="mt-3 w-full rounded-lg border border-dashed border-[#E4E7EC] py-2.5 text-[12px] font-medium text-[#6B7280] hover:border-[#FECACA] hover:text-[#DC2626] hover:bg-[#FFF8F8] transition-all cursor-pointer"
              >
                + Add another item
              </button>

              <FieldErr
                msg={
                  typeof errors.line_items?.message === 'string'
                    ? errors.line_items.message
                    : undefined
                }
              />

              {fields.length > 0 && (
                <div className="mt-4 rounded-lg border border-[#E4E7EC] bg-[#FAFAFA] px-4 py-3 flex items-center justify-between">
                  <span className="text-[12px] font-medium text-[#6B7280]">
                    {fields.length} items in this quotation
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/quotations')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {isEdit ? 'Save Changes' : 'Create Quotation'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

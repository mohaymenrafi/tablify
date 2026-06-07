import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data, redirect, useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  getTable,
  parseTableForm,
  setTableMetaobjectId,
  updateTable,
} from "../models/table.server";
import { syncTableMetaobject } from "../models/metaobject.server";
import TableForm from "../components/TableForm";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const table = await getTable(session.shop, params.id as string);
  if (!table) {
    throw data("Table not found", { status: 404 });
  }
  return { table };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const id = params.id as string;
  const formData = await request.formData();
  const { data: parsed, errors } = parseTableForm(formData);

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const existing = await getTable(session.shop, id);
  await updateTable(session.shop, id, parsed);

  const metaobjectId = await syncTableMetaobject(
    admin,
    { tableId: id, name: parsed.name },
    existing?.metaobjectId ?? null,
  );
  if (metaobjectId && metaobjectId !== existing?.metaobjectId) {
    await setTableMetaobjectId(session.shop, id, metaobjectId);
  }
  return redirect("/app");
};

export default function EditTable() {
  const { table } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  return <TableForm mode="edit" table={table} errors={actionData?.errors} />;
}

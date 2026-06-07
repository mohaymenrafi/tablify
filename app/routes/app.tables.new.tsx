import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  createTable,
  parseTableForm,
  setTableMetaobjectId,
} from "../models/table.server";
import { syncTableMetaobject } from "../models/metaobject.server";
import TableForm from "../components/TableForm";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const { data, errors } = parseTableForm(formData);

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const table = await createTable(session.shop, data);
  const metaobjectId = await syncTableMetaobject(
    admin,
    { tableId: table.id, name: table.name },
    null,
  );
  if (metaobjectId) {
    await setTableMetaobjectId(session.shop, table.id, metaobjectId);
  }
  return redirect("/app");
};

export default function NewTable() {
  const actionData = useActionData<typeof action>();
  return <TableForm mode="create" errors={actionData?.errors} />;
}

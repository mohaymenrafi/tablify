import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData } from "react-router";
import { authenticate } from "../shopify.server";
import { createTable, parseTableForm } from "../models/table.server";
import TableForm from "../components/TableForm";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const { data, errors } = parseTableForm(formData);

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  await createTable(session.shop, data);
  return redirect("/app");
};

export default function NewTable() {
  const actionData = useActionData<typeof action>();
  return <TableForm mode="create" errors={actionData?.errors} />;
}

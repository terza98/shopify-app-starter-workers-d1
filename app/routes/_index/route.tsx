import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import { embeddedEntryRedirect, isFramedRequest } from "../../lib/embedded-entry";
import { useInFrame } from "../../lib/use-in-frame";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // The admin reaches `/` in more shapes than `?shop=` -- see embedded-entry.ts.
  const target = embeddedEntryRedirect(request);
  if (target) throw redirect(target);

  return { showForm: Boolean(login), framed: isFramedRequest(request) };
};

export default function App() {
  const { showForm, framed } = useLoaderData<typeof loader>();
  const inFrame = useInFrame(framed);

  // Inside the admin with no way to tell which shop: point the merchant back
  // rather than showing the public page (and its login form) in their admin.
  if (inFrame) {
    return (
      <div className={styles.index}>
        <div className={styles.content}>
          <p className={styles.text}>
            This page opened outside the app. Open the app again from Apps in
            your Shopify admin.
          </p>
          <p className={styles.text}>
            <a href="https://admin.shopify.com" target="_top">
              Open Shopify admin
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>A short heading about [your app]</h1>
        <p className={styles.text}>
          A tagline about [your app] that describes your value proposition.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Product feature</strong>. Some detail about your feature and
            its benefit to your customer.
          </li>
          <li>
            <strong>Product feature</strong>. Some detail about your feature and
            its benefit to your customer.
          </li>
          <li>
            <strong>Product feature</strong>. Some detail about your feature and
            its benefit to your customer.
          </li>
        </ul>
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isValidLogin } from "@/data/github/fetchCityInput";

/** Asks for a GitHub username and opens its city. */
export function UsernameForm() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [invalid, setInvalid] = useState(false);

  return (
    <form
      className="username-form"
      onSubmit={(e) => {
        e.preventDefault();
        const value = login.trim().replace(/^@/, "");
        if (!isValidLogin(value)) {
          setInvalid(true);
          return;
        }
        router.push(`/u/${value}`);
      }}
    >
      <label htmlFor="login">GitHub username</label>
      <div>
        <span aria-hidden="true">github.com/</span>
        <input
          id="login"
          name="login"
          value={login}
          onChange={(e) => {
            setLogin(e.target.value);
            setInvalid(false);
          }}
          placeholder="octocat"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          aria-invalid={invalid}
          aria-describedby={invalid ? "login-error" : undefined}
        />
        <button type="submit">Build city</button>
      </div>
      {invalid && (
        <p id="login-error" role="alert">
          Usernames use letters, numbers and single hyphens, up to 39 characters.
        </p>
      )}
    </form>
  );
}

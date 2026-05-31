import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  bossCreateStaffAccount,
  bossSetAccountActive,
  bossResetPassword,
  bossUpdateStaffProfile,
  bossSetTempPassword,
  bossDeletePerson,
} from "@/lib/boss.functions";
import type { BossStaffRow } from "@/types/boss";

export function useBossStaffList() {
  return useQuery({
    queryKey: ["boss", "staff"],
    queryFn: async (): Promise<BossStaffRow[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id,email,full_name,phone,work_email,role,is_active,disabled_at,password_reset_requested_at,created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BossStaffRow[];
    },
  });
}

export function useBossStaffManagement() {
  const qc = useQueryClient();
  const create = useServerFn(bossCreateStaffAccount);
  const setActive = useServerFn(bossSetAccountActive);
  const reset = useServerFn(bossResetPassword);
  const update = useServerFn(bossUpdateStaffProfile);
  const temp = useServerFn(bossSetTempPassword);
  const del = useServerFn(bossDeletePerson);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["boss", "staff"] });
    qc.invalidateQueries({ queryKey: ["boss", "audit"] });
    qc.invalidateQueries({ queryKey: ["people", "directory"] });
  };

  return {
    createAccount: useMutation({
      mutationFn: (input: Parameters<typeof create>[0]["data"]) =>
        create({ data: input }),
      onSuccess: invalidate,
    }),
    setActive: useMutation({
      mutationFn: (input: Parameters<typeof setActive>[0]["data"]) =>
        setActive({ data: input }),
      onSuccess: invalidate,
    }),
    resetPassword: useMutation({
      mutationFn: (input: Parameters<typeof reset>[0]["data"]) =>
        reset({ data: input }),
      onSuccess: invalidate,
    }),
    updateProfile: useMutation({
      mutationFn: (input: Parameters<typeof update>[0]["data"]) =>
        update({ data: input }),
      onSuccess: invalidate,
    }),
    setTempPassword: useMutation({
      mutationFn: (input: Parameters<typeof temp>[0]["data"]) =>
        temp({ data: input }),
      onSuccess: invalidate,
    }),
    deletePerson: useMutation({
      mutationFn: (input: Parameters<typeof del>[0]["data"]) =>
        del({ data: input }),
      onSuccess: invalidate,
    }),
  };
}
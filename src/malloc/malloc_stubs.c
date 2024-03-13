#include <malloc.h>
#include <caml/fail.h>

CAMLprim value malloc_trim_stub(value v_n)
{
#ifdef __GLIBC__
  int ret = malloc_trim(Int_val(v_n));
  return Val_bool(ret);
#endif
  return Val_bool(1);
}

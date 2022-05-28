import { motion } from "framer-motion";

const ListTransition = (props) => {
  return (
    <motion.div
      {...props}
      layout
      animate={{ opacity: 1, scale: 1 }}
      initial={{ opacity: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      {props.children}
    </motion.div>
  );
};

export default ListTransition;
